import { supabase } from './supabase';

export interface GameSupabase {
  id: string;
  owner_id: string;
  title: string;
  platform: string;
  status: 'Jogando' | 'Pendente' | 'Zerado' | 'Abandonado';
  rating: number;
  image?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export const gameService = {
  async getGames() {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Supabase Error detail:", error);
      let errorMessage = error.message;
      
      if (!errorMessage || errorMessage === '{}') {
        // Handle cases where error is not a simple object or is a network error
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          errorMessage = "Falha na rede: Não foi possível conectar ao Supabase. Isso pode ser causado por bloqueadores de anúncios ou restrições do navegador (como o 'Prevent Cross-Site Tracking' no Safari).";
        } else {
          errorMessage = `Erro desconhecido no Supabase. Código: ${error.code || 'sem código'}. Verifique o console do navegador para detalhes técnicos.`;
        }
      }
      
      throw new Error(errorMessage);
    }
    return data as GameSupabase[];
  },

  async addGame(game: Omit<GameSupabase, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('games')
      .insert([game])
      .select()
      .single();
    
    if (error) {
      console.error("Supabase Insert Error detail:", error);
      const err = error as { message?: string; error_description?: string; error?: string };
      const errorMessage = err.message || err.error_description || err.error || JSON.stringify(error);
      throw new Error(errorMessage === '{}' ? `Unknown error during insert. Code: ${error.code}` : errorMessage);
    }
    return data as GameSupabase;
  },

  async updateGame(id: string, updates: Partial<GameSupabase>) {
    const { data, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error("Supabase Update Error detail:", error);
      const err = error as { message?: string; error_description?: string; error?: string };
      const errorMessage = err.message || err.error_description || err.error || JSON.stringify(error);
      throw new Error(errorMessage === '{}' ? `Unknown error during update. Code: ${error.code}` : errorMessage);
    }
    return data as GameSupabase;
  },

  async deleteGame(id: string) {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error("Supabase Delete Error detail:", error);
      const err = error as { message?: string; error_description?: string; error?: string };
      const errorMessage = err.message || err.error_description || err.error || JSON.stringify(error);
      throw new Error(errorMessage === '{}' ? `Unknown error during delete. Code: ${error.code}` : errorMessage);
    }
  }
};
