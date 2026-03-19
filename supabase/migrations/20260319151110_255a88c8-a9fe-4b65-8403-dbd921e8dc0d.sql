CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);