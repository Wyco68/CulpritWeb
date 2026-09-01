'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { UpdateProfileInput } from '../profile.schema';
import { Button } from '@/modules/shared/ui/button';
import { Input } from '@/modules/shared/ui/input';
import { Textarea } from '@/modules/shared/ui/textarea';
import { FormField } from '@/modules/shared/ui/form-field';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';

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
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<UpdateProfileInput>();
  const { fields, append, remove, move } = useFieldArray({ control, name });

  const fieldErrors = errors[name];

  const addItem = () => append({ title: '', subtitle: '', year: '', description: '' });

  return (
    // Rendered through the shared FormSection so all seven CV lists carry the same landmark
    // treatment as the rest of the profile form. The count sits beside the heading because
    // "how many entries does this section already have" is the first thing you want to know
    // when scanning a form this long.
    <FormSection
      title={heading}
      badge={<FormSectionCount count={fields.length} />}
      action={
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="size-4" aria-hidden="true" />
          Add item
        </Button>
      }
    >
      {fields.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No entries yet. Use “Add item” to create the first one.
        </p>
      )}

      <ol className="flex flex-col">
        {fields.map((field, index) => {
          const rowError = Array.isArray(fieldErrors) ? fieldErrors[index] : undefined;
          return (
            // Rule-separated and numbered rather than each row in its own tinted box. The fields
            // inside are already bordered wells, so a box around them made three nested frames
            // and buried the actual inputs.
            <li key={field.id} className="border-t border-border py-6 first:border-t-0 first:pt-0">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="tabular font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move entry ${index + 1} up`}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move entry ${index + 1} down`}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label={`Remove entry ${index + 1}`}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <FormField
                  label="Title"
                  htmlFor={`${name}.${index}.title`}
                  required
                  error={rowError?.title?.message}
                >
                  {(fieldProps) => (
                    <Input {...fieldProps} {...register(`${name}.${index}.title` as const)} />
                  )}
                </FormField>
                <FormField
                  label="Year"
                  htmlFor={`${name}.${index}.year`}
                  error={rowError?.year?.message}
                >
                  {(fieldProps) => (
                    <Input {...fieldProps} {...register(`${name}.${index}.year` as const)} />
                  )}
                </FormField>
                <FormField
                  label="Subtitle"
                  htmlFor={`${name}.${index}.subtitle`}
                  error={rowError?.subtitle?.message}
                  className="sm:col-span-2"
                >
                  {(fieldProps) => (
                    <Input {...fieldProps} {...register(`${name}.${index}.subtitle` as const)} />
                  )}
                </FormField>
                <FormField
                  label="Description"
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

            </li>
          );
        })}
      </ol>
    </FormSection>
  );
}
