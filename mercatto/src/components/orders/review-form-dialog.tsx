"use client";

import { useActionState, useState } from "react";
import { Loader2, Star } from "lucide-react";

import { createReviewAction } from "@/lib/actions/reviews";
import type { ActionState } from "@/lib/actions/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { status: "idle" };

export function ReviewFormDialog({ orderItemId, productName }: { orderItemId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await createReviewAction(prevState, formData);
      if (result.status === "success") setOpen(false);
      return result;
    },
    initialState,
  );

  const displayRating = hoverRating || rating;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Avaliar produto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avaliar produto</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="orderItemId" value={orderItemId} />
          <input type="hidden" name="rating" value={rating} />

          <div>
            <Label>Sua nota</Label>
            <div className="mt-1.5 flex gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                  className="p-0.5"
                >
                  <Star
                    className={`size-7 transition-colors ${
                      star <= displayRating ? "fill-warning text-warning" : "text-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="title">Título (opcional)</Label>
            <Input id="title" name="title" maxLength={120} className="mt-1.5" />
          </div>

          <div>
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea id="comment" name="comment" maxLength={2000} className="mt-1.5 min-h-24" />
          </div>

          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <Button type="submit" disabled={isPending || rating === 0}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Enviar avaliação
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
