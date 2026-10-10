import {
  Apple, Baby, Beer, Bike, Book, Briefcase, Building2, Bus, Car, Coffee, CreditCard, Dumbbell, Film, Fuel, Gamepad2,
  Gift, GraduationCap, HandCoins, Heart, House, Landmark, Music, Package, PawPrint, PiggyBank, Pill, Pizza, Plane,
  Repeat, Scissors, Shirt, ShoppingBag, ShoppingBasket, Smartphone, Sparkles, Stethoscope, Tag, Tv, Users,
  UtensilsCrossed, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

/** Iconos que el usuario puede elegir para sus categorías (nombre guardado → componente). */
export const ICONOS: Record<string, LucideIcon> = {
  canasta: ShoppingBasket, cubiertos: UtensilsCrossed, pizza: Pizza, apple: Apple, cafe: Coffee, cerveza: Beer,
  casa: House, rayo: Zap, repetir: Repeat, wifi: Wifi, celular: Smartphone, herramienta: Wrench, edificio: Building2,
  auto: Car, surtidor: Fuel, bus: Bus, bici: Bike, avion: Plane,
  bebe: Baby, huella: PawPrint, regalo: Gift, familia: Users, corazon: Heart,
  destellos: Sparkles, tijeras: Scissors, birrete: GraduationCap, libro: Book, control: Gamepad2, polo: Shirt,
  estetoscopio: Stethoscope, pastilla: Pill, pesas: Dumbbell, cine: Film, musica: Music, tv: Tv, bolsa: ShoppingBag,
  tarjeta: CreditCard, alcancia: PiggyBank, maletin: Briefcase, billetera: Wallet, banco: Landmark, monedas: HandCoins,
  caja: Package, etiqueta: Tag,
};

export const iconoDe = (nombre: string | null | undefined): LucideIcon => (nombre && ICONOS[nombre]) || Tag;
