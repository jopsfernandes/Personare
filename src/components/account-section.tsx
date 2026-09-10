import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSession, login, logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

interface Session {
  avatarUrl: string | null;
  email: string;
  id: string;
  name: string;
}

export default function AccountSection() {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [isAwaitingLogin, setIsAwaitingLogin] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  useEffect(() => {
    if (!isAwaitingLogin) {
      return;
    }

    const interval = setInterval(() => {
      getSession().then((nextSession) => {
        if (nextSession) {
          setSession(nextSession);
          setIsAwaitingLogin(false);
        }
      });
    }, POLL_INTERVAL_MS);
    const timeout = setTimeout(() => {
      setIsAwaitingLogin(false);
    }, POLL_TIMEOUT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isAwaitingLogin]);

  const handleLoginClick = useCallback(() => {
    login();
    setIsAwaitingLogin(true);
  }, []);

  const handleLogoutClick = useCallback(() => {
    logout().then(() => {
      setSession(null);
    });
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{t("accountSectionTitle")}</h2>
      <p className="text-muted-foreground text-sm">
        {t("accountSectionDescription")}
      </p>
      {session ? (
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span>{session.name}</span>
            <span className="text-muted-foreground text-sm">
              {session.email}
            </span>
          </div>
          <Button onClick={handleLogoutClick} variant="outline">
            {t("logoutAction")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button disabled={isAwaitingLogin} onClick={handleLoginClick}>
            {t("loginWithGoogleAction")}
          </Button>
          {isAwaitingLogin ? (
            <p className="text-muted-foreground text-sm">
              {t("waitingForGoogleLoginMessage")}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
