import {
  DESTINATION_TYPES,
  RESPONSE_LIMITS,
  type DestinationType,
  type ResponseDashboard,
} from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Select, TextArea, TextInput } from '../../../shared/ui/fields';
import type { AllocationFlow } from '../hooks/useAllocationFlow';

const DESTINATION_LABEL: Record<DestinationType, string> = {
  Shelter: 'Shelter',
  Area: 'Area (district)',
  Team: 'Team',
};

/** The destination list follows the chosen type: shelters, districts (areas) or rescue teams. */
function destinationOptions(
  data: ResponseDashboard,
  type: DestinationType | '',
): { id: number; name: string }[] {
  if (type === 'Shelter') return data.shelters;
  if (type === 'Area') return data.areas;
  if (type === 'Team') return data.teams;
  return [];
}

/** Step B2: resource, quantity in the resource's own unit, destination and instructions. */
export function AllocationForm({ flow, data }: { flow: AllocationFlow; data: ResponseDashboard }) {
  const { form, busy } = flow;
  const unit = data.resources.find((resource) => resource.id === Number(form.resourceId))?.unit;
  return (
    <form className="stack" onSubmit={(event) => void flow.review(event)} noValidate>
      <Select
        label="Resource"
        value={form.resourceId}
        onChange={(event) => form.setResourceId(event.target.value)}
        error={form.errors.resourceId}
      >
        <option value="">Choose a resource</option>
        {data.resources.map((resource) => (
          <option key={resource.id} value={resource.id}>
            {resource.name} ({resource.quantityLabel} available)
          </option>
        ))}
      </Select>
      <TextInput
        label="Quantity"
        hint={
          form.resourceId ? `In ${unit ?? 'the resource unit'}` : 'Counted in the resource unit'
        }
        inputMode="numeric"
        value={form.quantity}
        onChange={(event) => form.setQuantity(event.target.value)}
        error={form.errors.quantity}
      />
      <Select
        label="Destination type"
        value={form.destinationType}
        onChange={(event) => {
          form.setDestinationType(event.target.value as DestinationType | '');
          form.setDestinationId('');
        }}
        error={form.errors.destinationType}
      >
        <option value="">Choose a destination type</option>
        {DESTINATION_TYPES.map((type) => (
          <option key={type} value={type}>
            {DESTINATION_LABEL[type]}
          </option>
        ))}
      </Select>
      <Select
        label="Destination"
        value={form.destinationId}
        onChange={(event) => form.setDestinationId(event.target.value)}
        error={form.errors.destinationId}
        disabled={!form.destinationType}
      >
        <option value="">Choose the destination</option>
        {destinationOptions(data, form.destinationType).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      <TextArea
        label="Instructions"
        hint="Optional"
        value={form.instructions}
        onChange={(event) => form.setInstructions(event.target.value)}
        maxLength={RESPONSE_LIMITS.maxTextLength}
      />
      <div>
        <Button type="submit" loading={busy}>
          Review allocation
        </Button>
      </div>
    </form>
  );
}
