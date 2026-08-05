'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { UpdateProfileInput } from '../profile.schema';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';

// Repeatable CV-style row editor (add / remove / reorder) shared by all 7 JSON list fields on the
// profile form (education, fellowships, teaching roles/awards, scholarships, research interests,
// invited talks) — every one is the same `{ title, subtitle?, year?, description? }[]` shape, so
// one generic editor replaces seven near-identical hand-rolled sub-forms.
type ListFieldName = Extract<
  keyof UpdateProfileInput,
  | 'education'
  | 'fellowshipsVisiting'
  | 'teachingRoles'
  | 'teachingAwards'
  | 'scholarshipsTravelAwards'
  | 'researchInterests'
  | 'invitedTalks'
>;

export function ListFieldEditor({ name, heading }: { name: ListFieldName; heading: string }) {
  const t = useTranslations('admin.profile.item');
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<UpdateProfileInput>();
  const { fields, append, remove, move } = useFieldArray({ control, name });

  const fieldErrors = errors[name];

  return (
    <fieldset className="rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">{heading}</legend>

      {fields.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}

      <ol className="flex flex-col gap-4">
        {fields.map((field, index) => {
          const rowError = Array.isArray(fieldErrors) ? fieldErrors[index] : undefined;
          return (
            <li key={field.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label={t('titleLabel')}
                  htmlFor={`${name}.${index}.title`}
                  required
                  error={rowError?.title?.message}
                >
                  {(fieldProps) => (
                    <Input {...fieldProps} {...register(`${name}.${index}.title` as const)} />
                  )}
                </FormField>
                <FormField
                  label={t('yearLabel')}
                  htmlFor={`${name}.${index}.year`}
                  error={rowError?.year?.message}
                >
                  {(fieldProps) => (
                    <Input {...fieldProps} {...register(`${name}.${index}.year` as const)} />
                  )}
                </FormField>
                <FormField
                  label={t('subtitleLabel')}
                  htmlFor={`${name}.${index}.subtitle`}
                  error={rowError?.subtitle?.message}
                  className="sm:col-span-2"
                >
                  {(fieldProps) => (
                    <Input {...fieldProps} {...register(`${name}.${index}.subtitle` as const)} />
                  )}
                </FormField>
                <FormField
                  label={t('descriptionLabel')}
                  htmlFor={`${name}.${index}.description`}
                  error={rowError?.description?.message}
                  className="sm:col-span-2"
                >
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      {...register(`${name}.${index}.description` as const)}
                    />
                  )}
                </FormField>
              </div>

              <div className="mt-3 flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  aria-label={t('moveUp')}
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={t('moveDown')}
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label={t('removeItem')}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => append({ title: '', subtitle: '', year: '', description: '' })}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('addItem')}
      </Button>
    </fieldset>
  );
}
