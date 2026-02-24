import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Subscribes to Realtime changes on the `generations` table
 * and invalidates React Query caches so the UI updates live.
 */
export function useGenerationsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("generations-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generations",
          filter: `user_id=eq.${user.id}`,
        },
        (_payload) => {
          qc.invalidateQueries({ queryKey: ["generations-all"] });
          qc.invalidateQueries({ queryKey: ["batches"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generation_batches",
          filter: `user_id=eq.${user.id}`,
        },
        (_payload) => {
          qc.invalidateQueries({ queryKey: ["batches"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);
}
