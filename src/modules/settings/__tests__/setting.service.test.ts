import { describe, expect, it, vi } from 'vitest';
import { createSettingsService } from '../setting.service';
import type { SettingRepository } from '../setting.repository';
import { SETTING_KEYS } from '../setting.types';

class FakeRepository implements SettingRepository {
  values = new Map<string, unknown>();
  audits: { actor: string; action: string; entityId: string }[] = [];

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (this.values.has(key)) out[key] = this.values.get(key);
    }
    return out;
  }

  async setManyWithAudit(input: {
    values: Record<string, unknown>;
    audit: { actor: string; action: string };
  }): Promise<void> {
    for (const [key, value] of Object.entries(input.values)) this.values.set(key, value);
    this.audits.push({
      ...input.audit,
      entityId: Object.keys(input.values).join(','),
    });
  }
}

function build() {
  const repository = new FakeRepository();
  const service = createSettingsService({
    repository,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { repository, service };
}

describe('settings service', () => {
  it('getSettings() returns the documented default when no rows exist', async () => {
    const { service } = build();
    const result = await service.getSettings();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upcomingEventsVisible).toBe(false);
  });

  it('updateSettings() persists the key and audits', async () => {
    const { repository, service } = build();
    const result = await service.updateSettings({ upcomingEventsVisible: true }, 'admin:1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upcomingEventsVisible).toBe(true);
    expect(repository.values.get(SETTING_KEYS.upcomingEventsVisible)).toBe(true);
    expect(repository.audits.at(-1)?.action).toBe('settings.update');
  });

  it('getSetting() reads a single typed value with its default applied', async () => {
    const { service } = build();
    expect(await service.getSetting('upcomingEventsVisible')).toBe(false);
    await service.updateSettings({ upcomingEventsVisible: true }, 'admin:1');
    expect(await service.getSetting('upcomingEventsVisible')).toBe(true);
  });
});
