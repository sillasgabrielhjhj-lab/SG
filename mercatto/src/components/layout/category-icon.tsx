import {
  Backpack, Bike, Blend, Car, CircleDot, Coffee, CookingPot, Drill, Droplet, Dumbbell, Fan, Footprints, Gamepad2, Glasses, Headphones, Headset, Joystick,
  Keyboard, Lamp, LayoutGrid, Laptop, Microwave, Monitor, PersonStanding, Refrigerator, Shirt, Smartphone, Sofa, Sparkles, Speaker, SprayCan, Tablet,
  Toolbox, Tv, Volleyball, WashingMachine, Watch, Wind, Wrench, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Backpack, Bike, Blend, Car, CircleDot, Coffee, CookingPot, Drill, Droplet, Dumbbell, Fan, Footprints, Gamepad2, Glasses, Headphones, Headset, Joystick,
  Keyboard, Lamp, Laptop, Microwave, Monitor, PersonStanding, Refrigerator, Shirt, Smartphone, Sofa, Sparkles, Speaker, SprayCan, Tablet, Toolbox, Tv,
  Volleyball, WashingMachine, Watch, Wind, Wrench,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS).sort();

/** Ícone de categoria pelo nome salvo no banco (fallback seguro). */
export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || LayoutGrid;
  return <Icon className={className} aria-hidden />;
}
