import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import MarkdownContent from "@/components/markdown-content";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface MarkdownEditorProps {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}

export default function MarkdownEditor({
  id,
  label,
  onChange,
  placeholder,
  required,
  value,
}: MarkdownEditorProps) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">{t("markdownWriteTabLabel")}</TabsTrigger>
          <TabsTrigger value="preview">
            {t("markdownPreviewTabLabel")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            id={id}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            value={value}
          />
        </TabsContent>
        <TabsContent value="preview">
          <MarkdownContent
            className="min-h-16 rounded-md border border-input px-2 py-2"
            content={value}
          />
        </TabsContent>
      </Tabs>
      <p className="text-muted-foreground text-xs">
        {t("markdownLatexHintMessage")}
      </p>
    </div>
  );
}
