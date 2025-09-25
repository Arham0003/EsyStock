import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, Store, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Settings {
  id: string;
  currency: string;
  gst_enabled: boolean;
  default_gst_rate: number;
}

interface Account {
  id: string;
  name: string;
}

export default function Settings() {
  const { isOwner, profile } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [settingsRes, accountRes] = await Promise.all([
        supabase
          .from('settings')
          .select('*')
          .eq('account_id', profile?.account_id)
          .single(),
        supabase
          .from('accounts')
          .select('*')
          .eq('id', profile?.account_id)
          .single()
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (accountRes.error) throw accountRes.error;

      setSettings(settingsRes.data);
      setAccount(accountRes.data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching settings",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.account_id) {
      fetchData();
    }
  }, [profile?.account_id]);

  const handleSaveAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('storeName') as string;

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ name })
        .eq('id', profile?.account_id);

      if (error) throw error;

      toast({
        title: "Store name updated",
        description: "Your store name has been updated successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating store name",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const currency = formData.get('currency') as string;
    const defaultGstRate = parseFloat(formData.get('defaultGstRate') as string);
    const gstEnabled = formData.get('gstEnabled') === 'on';

    try {
      const { error } = await supabase
        .from('settings')
        .update({
          currency,
          default_gst_rate: defaultGstRate,
          gst_enabled: gstEnabled,
        })
        .eq('account_id', profile?.account_id);

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Your settings have been updated successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating settings",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Memoize role display text
  const roleDisplayText = useMemo(() => 
    profile?.role === 'owner' ? 'Store Owner' : 'Worker',
    [profile?.role]
  );

  if (!isOwner) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your store settings and preferences</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Store Information
            </CardTitle>
            <CardDescription>
              Update your store details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Store Name</Label>
                <Input
                  id="storeName"
                  name="storeName"
                  defaultValue={account?.name}
                  placeholder="Enter your store name"
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Store Information"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Settings
            </CardTitle>
            <CardDescription>
              Configure currency and tax settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  name="currency"
                  defaultValue={settings?.currency}
                  placeholder="INR"
                  required
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="gstEnabled">Enable GST</Label>
                  <p className="text-sm text-muted-foreground">
                    Calculate and display GST on sales
                  </p>
                </div>
                <Switch 
                  id="gstEnabled"
                  name="gstEnabled"
                  defaultChecked={settings?.gst_enabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultGstRate">Default GST Rate (%)</Label>
                <Input
                  id="defaultGstRate"
                  name="defaultGstRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={settings?.default_gst_rate}
                  placeholder="18.0"
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Financial Settings"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground mt-1">{profile?.email}</p>
            </div>
            <div>
              <Label>Role</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {roleDisplayText}
              </p>
            </div>
            <div>
              <Label>Account ID</Label>
              <p className="text-sm text-muted-foreground mt-1 font-mono">{profile?.account_id}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}