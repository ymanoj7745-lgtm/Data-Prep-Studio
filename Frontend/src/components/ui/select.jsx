import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className = "", children, ...props }) {
  return (
    <SelectPrimitive.Trigger className={className} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={14} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectScrollUpButton({ className = "", ...props }) {
  return (
    <SelectPrimitive.ScrollUpButton className={className} {...props}>
      <ChevronUp size={14} />
    </SelectPrimitive.ScrollUpButton>
  );
}

export function SelectScrollDownButton({ className = "", ...props }) {
  return (
    <SelectPrimitive.ScrollDownButton className={className} {...props}>
      <ChevronDown size={14} />
    </SelectPrimitive.ScrollDownButton>
  );
}

export function SelectContent({ className = "", children, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className={className} {...props}>
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className = "", ...props }) {
  return <SelectPrimitive.Label className={className} {...props} />;
}

export function SelectItem({ className = "", children, ...props }) {
  return (
    <SelectPrimitive.Item className={className} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check size={14} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({ className = "", ...props }) {
  return <SelectPrimitive.Separator className={className} {...props} />;
}
