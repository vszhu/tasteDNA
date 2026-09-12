import type { Dish, MenuItem } from "@/types";

export function DishIngredientDetails({ dish }: { dish: Dish }) {
  return <div className="text-xs leading-5">
    <p className="text-[var(--muted)]">{dish.ingredients?.length ? dish.ingredients.join(", ") : "Ingredient details unavailable."}</p>
    {dish.ingredientSource?.kind === "published-menu" ? <p className="mt-1 text-[#315e4b]"><a href={dish.ingredientSource.url} target="_blank" rel="noreferrer" className="underline">Published menu components</a> · Confirm sauces, subingredients, and availability.</p>
      : dish.ingredients?.length ? <p className="mt-1 font-semibold text-[#71561d]">{dish.ingredientSource?.kind === "estimated" ? "Recipe estimate — not confirmed by the restaurant." : "Extracted menu details — confirm with the restaurant."}</p> : null}
  </div>;
}

export function VenueIngredientDetails({ items }: { items: MenuItem[] }) {
  if (!items.length) return null;
  return <details className="mt-3 border-t border-[var(--line)] pt-3">
    <summary className="cursor-pointer text-xs font-semibold text-[var(--tomato)]">View dishes and ingredients ({items.length})</summary>
    <ul className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-2">
      {items.map((item) => <li key={item.id} className="text-xs leading-5">
        <p className="font-bold text-[var(--ink)]">{item.dish.name}</p>
        <DishIngredientDetails dish={item.dish} />
      </li>)}
    </ul>
  </details>;
}
