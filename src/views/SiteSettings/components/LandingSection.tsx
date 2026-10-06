import { Switch } from "@/components/ui/switch";
import { t } from "@/i18n";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { SiteSettings, HeroPillar, FeatureCard, FooterLink } from "@/models/types/siteSettings.types";

interface Props {
  settings: SiteSettings;
  onChange: (s: SiteSettings) => void;
}

export const LandingSection = ({ settings, onChange }: Props) => {
  const updatePillar = (index: number, field: keyof HeroPillar, value: string) => {
    const pillars = [...settings.hero_pillars];
    pillars[index] = { ...pillars[index], [field]: value };
    onChange({ ...settings, hero_pillars: pillars });
  };

  const addPillar = () => {
    onChange({ ...settings, hero_pillars: [...settings.hero_pillars, { title: "", description: "" }] });
  };

  const removePillar = (index: number) => {
    onChange({ ...settings, hero_pillars: settings.hero_pillars.filter((_, i) => i !== index) });
  };

  const updateFeature = (index: number, field: keyof FeatureCard, value: string | string[]) => {
    const cards = [...settings.feature_cards];
    cards[index] = { ...cards[index], [field]: value };
    onChange({ ...settings, feature_cards: cards });
  };

  const addFeature = () => {
    onChange({
      ...settings,
      feature_cards: [...settings.feature_cards, { title: "", description: "", bullets: [""] }],
    });
  };

  const removeFeature = (index: number) => {
    onChange({ ...settings, feature_cards: settings.feature_cards.filter((_, i) => i !== index) });
  };

  const updateCtaBullet = (index: number, value: string) => {
    const bullets = [...settings.cta_bullets];
    bullets[index] = value;
    onChange({ ...settings, cta_bullets: bullets });
  };

  const addCtaBullet = () => {
    onChange({ ...settings, cta_bullets: [...settings.cta_bullets, ""] });
  };

  const removeCtaBullet = (index: number) => {
    onChange({ ...settings, cta_bullets: settings.cta_bullets.filter((_, i) => i !== index) });
  };

  const updateFooterLink = (index: number, field: keyof FooterLink, value: string) => {
    const links = [...(settings.footer_links || [])];
    links[index] = { ...links[index], [field]: value };
    onChange({ ...settings, footer_links: links });
  };

  const addFooterLink = () => {
    onChange({ ...settings, footer_links: [...(settings.footer_links || []), { text: "", url: "" }] });
  };

  const removeFooterLink = (index: number) => {
    onChange({ ...settings, footer_links: (settings.footer_links || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><Switch id="landing-mode" checked={settings.homepage_mode === "landing"} onCheckedChange={v => onChange({ ...settings, homepage_mode: v ? "landing" : "catalogue" })} /><Label htmlFor="landing-mode">{t("Show full landing page instead of catalogue")}</Label></div>
      {/* Hero */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hero section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Badge text</Label>
            <Input value={settings.hero_badge} onChange={(e) => onChange({ ...settings, hero_badge: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={settings.hero_headline} onChange={(e) => onChange({ ...settings, hero_headline: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Headline (accent)</Label>
              <Input value={settings.hero_headline_accent} onChange={(e) => onChange({ ...settings, hero_headline_accent: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary CTA URL</Label>
              <Input value={settings.hero_cta_url} onChange={(e) => onChange({ ...settings, hero_cta_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Secondary CTA text</Label>
              <Input value={settings.hero_secondary_cta_text} onChange={(e) => onChange({ ...settings, hero_secondary_cta_text: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Secondary CTA URL</Label>
            <Input value={settings.hero_secondary_cta_url} onChange={(e) => onChange({ ...settings, hero_secondary_cta_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Textarea value={settings.hero_subtitle} onChange={(e) => onChange({ ...settings, hero_subtitle: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CTA button text</Label>
              <Input value={settings.hero_cta_text} onChange={(e) => onChange({ ...settings, hero_cta_text: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Navbar CTA text</Label>
              <Input value={settings.navbar_cta_text} onChange={(e) => onChange({ ...settings, navbar_cta_text: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Documentation URL</Label>
              <Input value={settings.hero_doc_url} onChange={(e) => onChange({ ...settings, hero_doc_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Documentation button text</Label>
              <Input value={settings.hero_doc_text} onChange={(e) => onChange({ ...settings, hero_doc_text: e.target.value })} />
            </div>
          </div>

          {/* Pillars */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Pillars (cards under hero)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPillar}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {settings.hero_pillars.map((p, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="Title" value={p.title} onChange={(e) => updatePillar(i, "title", e.target.value)} />
                  <Input placeholder="Description" value={p.description} onChange={(e) => updatePillar(i, "description", e.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removePillar(i)} className="shrink-0">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Features section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={settings.features_headline} onChange={(e) => onChange({ ...settings, features_headline: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Headline (accent)</Label>
              <Input value={settings.features_headline_accent} onChange={(e) => onChange({ ...settings, features_headline_accent: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Textarea value={settings.features_subtitle} onChange={(e) => onChange({ ...settings, features_subtitle: e.target.value })} rows={2} />
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Feature cards</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {settings.feature_cards.map((f, i) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Card {i + 1}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFeature(i)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <Input placeholder="Title" value={f.title} onChange={(e) => updateFeature(i, "title", e.target.value)} />
                <Textarea placeholder="Description" value={f.description} onChange={(e) => updateFeature(i, "description", e.target.value)} rows={2} />
                <div className="space-y-2">
                  <Label className="text-xs">Bullets (comma-separated)</Label>
                  <Input
                    value={f.bullets.join(", ")}
                    onChange={(e) => updateFeature(i, "bullets", e.target.value.split(",").map((s) => s.trim()))}
                    placeholder="Bullet 1, Bullet 2, Bullet 3"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CTA section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Headline</Label>
              <Input value={settings.cta_headline} onChange={(e) => onChange({ ...settings, cta_headline: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Headline (accent)</Label>
              <Input value={settings.cta_headline_accent} onChange={(e) => onChange({ ...settings, cta_headline_accent: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <Textarea value={settings.cta_subtitle} onChange={(e) => onChange({ ...settings, cta_subtitle: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>CTA button text</Label>
            <Input value={settings.cta_button_text} onChange={(e) => onChange({ ...settings, cta_button_text: e.target.value })} />
          </div>
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Bullets</Label>
              <Button type="button" variant="outline" size="sm" onClick={addCtaBullet}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {settings.cta_bullets.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input value={b} onChange={(e) => updateCtaBullet(i, e.target.value)} className="flex-1" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCtaBullet(i)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Footer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Footer text</Label>
            <Input value={settings.footer_text} onChange={(e) => onChange({ ...settings, footer_text: e.target.value })} placeholder="Shown after © Year Sitename." />
          </div>
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Footer links</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFooterLink}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {(settings.footer_links || []).map((link, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder="Text (e.g. Privacy policy)"
                    value={link.text}
                    onChange={(e) => updateFooterLink(i, "text", e.target.value)}
                  />
                  <Input
                    placeholder="URL or /path"
                    value={link.url}
                    onChange={(e) => updateFooterLink(i, "url", e.target.value)}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeFooterLink(i)} className="shrink-0">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
