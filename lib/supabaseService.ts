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
    
    if (error) throw error;
    return data as GameSupabase[];
  },

  async addGame(game: Omit<GameSupabase, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('games')
      .insert([game])
      .select()
      .single();
    
    if (error) throw error;
    return data as GameSupabase;
  },

  async updateGame(id: string, updates: Partial<GameSupabase>) {
    const { data, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as GameSupabase;
  },

  async deleteGame(id: string) {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
