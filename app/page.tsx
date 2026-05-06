'use client';

// Force Build: 2024-05-04_1715 (Sync Recovery)
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Home, 
  Library, 
  PlusCircle, 
  User as UserIcon, 
  Search, 
  TrendingUp, 
  Bookmark, 
  Sparkles, 
  Medal, 
  Star, 
  Trophy,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  LogIn,
  Trash2,
  Edit2,
  X,
  Loader2,
  ArrowLeft,
  Calendar,
  Upload,
  FileImage,
  FileDown,
  Mail,
  ShieldAlert,
  Type as LucideType
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { supabase } from '../lib/supabase';
import { gameService } from '../lib/supabaseService';
import { User } from '@supabase/supabase-js';
import { Type } from "@google/genai";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAI } from '../lib/ai';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// --- Types ---

interface Game {
  id: string;
  title: string;
  platform: string;
  status: 'Jogando' | 'Pendente' | 'Zerado' | 'Abandonado';
  rating: number;
  image: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  condition: (games: Game[]) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-game',
    title: 'Primeiro Passo',
    description: 'Adicionou o primeiro jogo no cofre.',
    icon: PlusCircle,
    condition: (games) => games.length >= 1,
  },
  {
    id: 'collector-10',
    title: 'Bibliotecário',
    description: 'Chegou à marca de 10 jogos na coleção.',
    icon: Library,
    condition: (games) => games.length >= 10,
  },
  {
    id: 'collector-50',
    title: 'Veterano',
    description: 'Uma coleção de respeito com 50 jogos.',
    icon: TrendingUp,
    condition: (games) => games.length >= 50,
  },
  {
    id: 'first-zerado',
    title: 'Game Master',
    description: 'Zerou o primeiro jogo da coleção.',
    icon: Trophy,
    condition: (games) => games.some(g => g.status === 'Zerado'),
  },
  {
    id: 'completionist-10',
    title: 'Completionist',
    description: 'Zerou 10 jogos diferentes.',
    icon: Medal,
    condition: (games) => games.filter(g => g.status === 'Zerado').length >= 10,
  },
  {
    id: 'multi-platform',
    title: 'Multi-Plataforma',
    description: 'Tem jogos em pelo menos 3 plataformas diferentes.',
    icon: LayoutDashboard,
    condition: (games) => new Set(games.map(g => g.platform)).size >= 3,
  },
  {
    id: 'perfect-score',
    title: 'Crítico de Arte',
    description: 'Avaliou um jogo com nota máxima (10).',
    icon: Star,
    condition: (games) => games.some(g => g.rating === 10),
  },
  {
    id: 'abandoned',
    title: 'Sincero',
    description: 'Admitiu que abandonou pelo menos um jogo.',
    icon: LogOut,
    condition: (games) => games.some(g => g.status === 'Abandonado'),
  }
];

const gameSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200),
  platform: z.string().min(1, 'Plataforma é obrigatória'),
  status: z.enum(['Jogando', 'Pendente', 'Zerado', 'Abandonado']),
  rating: z.coerce.number().min(0).max(10),
  image: z.string().url().optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
});

type GameFormData = z.infer<typeof gameSchema>;

// --- Components ---

const DeleteConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  gameTitle,
  isDeleting
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  gameTitle: string,
  isDeleting: boolean
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel w-full max-w-sm rounded-3xl p-8 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] text-center space-y-6"
      >
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
          <Trash2 size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-space font-bold text-white">REMOVER JOGO?</h3>
          <p className="text-slate-400 text-sm">
            Tem certeza que deseja remover <span className="text-white font-bold">&quot;{gameTitle}&quot;</span> da sua coleção? Esta ação é irreversível.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button 
            disabled={isDeleting}
            onClick={onConfirm}
            className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
            {isDeleting ? 'REMOVENDO...' : 'SIM, REMOVER'}
          </button>
          <button 
            disabled={isDeleting}
            onClick={onClose}
            className="w-full bg-white/5 text-slate-300 font-bold py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const GameModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData,
  defaultValues,
  showToast
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: GameFormData) => void,
  initialData?: Game | null,
  defaultValues?: Partial<GameFormData>,
  showToast: (message: string, type?: 'success' | 'error') => void
}) => {
  const [step, setStep] = useState<'search' | 'form'>(initialData ? 'form' : 'search');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [isExtendedSearch, setIsExtendedSearch] = useState(false);
  const [imageOptions, setImageOptions] = useState<{url: string, source: string}[]>([]);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [isShowingWarning, setIsShowingWarning] = useState(false);
  const [warningTime, setWarningTime] = useState(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) {
        showToast("A imagem é muito grande. Escolha uma imagem com menos de 1MB.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue('image', reader.result as string);
        setShowImageSelector(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<GameFormData>({
    resolver: zodResolver(gameSchema),
    defaultValues: initialData || {
      title: defaultValues?.title || '',
      platform: defaultValues?.platform || 'PC',
      status: defaultValues?.status || 'Jogando',
      rating: defaultValues?.rating || 0,
      image: defaultValues?.image || '',
    }
  });

  const selectedImage = watch('image');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setStep('form');
        reset(initialData);
      } else if (defaultValues) {
        setStep('form');
        reset({
          title: defaultValues.title || '',
          platform: defaultValues.platform || 'PC',
          status: defaultValues.status || 'Jogando',
          rating: defaultValues.rating || 0,
          image: defaultValues.image || '',
        });
      } else {
        setStep('search');
        setSearchQuery('');
        setSearchResults([]);
        setImageOptions([]);
        setIsExtendedSearch(false);
        setShowImageSelector(false);
        setImageSearchQuery('');
        reset({
          title: '',
          platform: 'PC',
          status: 'Jogando',
          rating: 0,
          image: '',
        });
      }
    }
  }, [isOpen, initialData, defaultValues, reset]);

  const searchGame = async (queryStr: string) => {
    if (!queryStr) return;
    setIsSearching(true);
    try {
      const ai = getAI();
      if (!ai) {
        showToast("Gemini AI está desativada. Verifique as configurações nos Créditos.", "error");
        return;
      }
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Find information for game: "${queryStr}". Return JSON list of 3 relevant games. 
        Each: {title, platform, image (Direct URL of official box art or high-quality cover), id (slug), rating (0-10), description}. 
        IMPORTANT: Use highly reliable sources like Wikipedia/Wikimedia Commons, Steam, IGDB, or official sites.
        Always provide the "description" in Brazilian Portuguese (Português do Brasil).`
          }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                platform: { type: Type.STRING },
                image: { type: Type.STRING },
                id: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                description: { type: Type.STRING },
              },
              required: ["title", "platform", "image", "id"],
            }
          }
        }
      });
      
      const responseText = result.response.text();
      if (!responseText) throw new Error("Sem resposta do AI");
      
      const gameData = JSON.parse(responseText);
      setSearchResults(Array.isArray(gameData) ? gameData : []);
    } catch (error: unknown) {
      const err = error as Error & { error?: { message?: string } };
      console.error("Search Error details:", err);
      
      // Catch specific "API key not valid" error
      if (err.message?.includes("API key not valid") || (err.error?.message?.includes("API key not valid"))) {
        showToast("Chave Gemini inválida. Verifique os Secrets nos Settings.", "error");
        return;
      }

      showToast("Erro ao buscar jogo. Tente novamente.", "error");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectGame = (game: Partial<Game>) => {
    if (game.title) setValue('title', game.title);
    if (game.image) setValue('image', game.image);
    if (game.rating) setValue('rating', game.rating);
    if (game.description) setValue('description', game.description);
    setIsShowingWarning(true);
    setWarningTime(5);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isShowingWarning && warningTime > 0) {
      timer = setInterval(() => {
        setWarningTime(t => t - 1);
      }, 1000);
    } else if (isShowingWarning && warningTime === 0) {
      setIsShowingWarning(false);
      setStep('form');
    }
    return () => clearInterval(timer);
  }, [isShowingWarning, warningTime]);

  const searchAlternativeImages = async (customQuery?: string, isExtended = false) => {
    const title = watch('title');
    const query = customQuery || imageSearchQuery || `${title} game official vertical cover art`;
    
    if (!query) return;
    
    setIsSearchingImages(true);
    setIsExtendedSearch(isExtended);
    setShowImageSelector(true);
    if (!customQuery) setImageSearchQuery(query);
    setImageOptions([]);
    
    try {
      const ai = getAI();
      if (!ai) {
        showToast("Gemini AI está desativada. Verifique as configurações nos Créditos.", "error");
        return;
      }
      const result = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: "user",
          parts: [{
            text: `Find vertical game cover art or high-quality box art for: "${query}". 
        Return a JSON list of 12 relevant and high-quality image URLs and their sources.
        CRITICAL: Prioritize images from Wikipedia, Wikimedia Commons, Steam, IGDB, or official publishers.
        Ensure URLs are direct to images (ending in .jpg, .png, etc.).`
          }]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                url: { type: Type.STRING },
                source: { type: Type.STRING }
              },
              required: ["url", "source"]
            }
          }
        }
      });
      
      const responseText = result.text;
      if (!responseText) throw new Error("Sem imagens encontradas");
      const images = JSON.parse(responseText);
      setImageOptions(Array.isArray(images) ? images : []);
    } catch (error: unknown) {
      const err = error as Error & { error?: { message?: string } };
      console.error("Image Search Error details:", err);

      // Catch specific "API key not valid" error
      if (err.message?.includes("API key not valid") || (err.error?.message?.includes("API key not valid"))) {
        showToast("Chave Gemini inválida. Verifique os Secrets nos Settings.", "error");
        return;
      }

      showToast("Erro ao buscar capas.", "error");
    } finally {
      setIsSearchingImages(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel w-full max-w-xl rounded-3xl p-8 border-[#00eefc]/20 shadow-[0_0_50px_rgba(0,238,252,0.15)] relative overflow-hidden flex flex-col max-h-[90vh]"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white z-20"><X size={24} /></button>
        
        <AnimatePresence mode="wait">
          {isShowingWarning ? (
            <motion.div 
              key="warning-step"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-[#00eefc]/10 rounded-full flex items-center justify-center mb-4 border border-[#00eefc]/20">
                <FileImage size={40} className="text-[#00eefc]" />
              </div>
              <h3 className="text-sm font-bold text-[#00eefc] uppercase tracking-widest">Dica Pro</h3>
              <p className="text-xl font-medium text-white leading-relaxed">
                Se a imagem do jogo não satisfaz tente modifica-la antes de finalizar o cadastro
              </p>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-white/5 border-t-[#00eefc] animate-spin mb-4" />
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold">
                  Prosseguindo em {warningTime}s...
                </p>
              </div>
            </motion.div>
          ) : step === 'search' ? (
            <motion.div 
              key="search-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8 py-4 overflow-y-auto"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-space font-bold text-white tracking-tight uppercase">BUSCAR NA WEB</h2>
                <p className="text-slate-400 text-sm">Encontre o jogo desejado para preenchimento automático.</p>
              </div>

              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00eefc] transition-colors" size={20} />
                <input 
                  autoFocus
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nome do jogo..." 
                  className="w-full bg-[#151a32] border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#00eefc] transition-all text-lg text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') searchGame(searchQuery);
                  }}
                />
                <button 
                  onClick={() => {
                    searchGame(searchQuery);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#00eefc] text-[#0d1229] px-4 py-2 rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all"
                >
                  {isSearching ? <Loader2 className="animate-spin" size={20} /> : 'BUSCAR'}
                </button>
              </div>

              <div className="space-y-4">
                {isSearching && searchResults.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-6 text-center">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-[#00eefc]/10 border-t-[#00eefc] rounded-xl animate-[spin_3s_linear_infinite]"></div>
                      <Sparkles size={32} className="absolute inset-0 m-auto text-[#00eefc] animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[#00eefc] font-space font-bold uppercase tracking-widest animate-pulse">Explorando a Web...</p>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter">Buscando as melhores ofertas e informações</p>
                    </div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {searchResults.map((game, i) => (
                        <button 
                          key={i}
                          onClick={() => selectGame(game)}
                          className="glass-card p-4 rounded-2xl flex items-center gap-4 hover:border-[#00eefc] transition-all group text-left border border-white/5"
                        >
                          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative bg-slate-800 border border-white/5 shadow-inner">
                            <Image 
                              src={game.image} 
                              alt={game.title} 
                              fill 
                              unoptimized
                              className="object-cover group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `https://picsum.photos/seed/${game.id}/200/300`;
                              }}
                            />
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="font-bold text-white truncate group-hover:text-[#00eefc] transition-colors">{game.title}</p>
                            <div className="flex items-center gap-2">
                               <p className="text-[10px] text-[#948f98] font-bold uppercase tracking-widest">{game.platform}</p>
                               <div className="w-1 h-1 rounded-full bg-white/10" />
                               <span className="text-[9px] text-slate-500 italic">Busca Web</span>
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-[#00eefc] opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center space-y-4">
                    <p className="text-slate-500 font-medium">Use a busca acima para encontrar títulos oficiais.</p>
                    <button 
                      onClick={() => setStep('form')}
                      className="text-[#00eefc] font-bold text-xs uppercase tracking-widest hover:underline"
                    >
                      Ou Pular para Cadastro Manual
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="form-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 py-4 overflow-y-auto"
            >
              <div className="flex items-center gap-4 mb-6">
                {!initialData && (
                  <button 
                    onClick={() => setStep('search')}
                    className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowRight className="rotate-180" size={20} />
                  </button>
                )}
                <h2 className="text-2xl font-space font-bold text-[#00eefc] tracking-tight uppercase">
                  {initialData ? 'Editar Jogo' : 'Finalizar Cadastro'}
                </h2>
              </div>

              {selectedImage ? (
                <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-white/10 mb-6 group/img">
                  <Image src={selectedImage} alt="Preview" fill unoptimized className="object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1229] to-transparent"></div>
                  <div className="absolute bottom-4 left-4">
                     <p className="text-white font-space font-bold uppercase tracking-tight text-lg drop-shadow-md">{watch('title')}</p>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/img:opacity-100 transition-all">
                    <button 
                      type="button"
                      onClick={() => searchAlternativeImages(`${watch('title')} game cover art`)}
                      className="bg-[#00eefc]/20 backdrop-blur-md text-[#00eefc] border border-[#00eefc]/30 px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-[#00eefc] hover:text-[#0d1229] transition-all uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Search size={12} />
                      Busca Web
                    </button>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-white hover:text-[#0d1229] transition-all uppercase tracking-widest flex items-center gap-1.5"
                    >
                      <Upload size={12} />
                      Upload
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 mb-6">
                  <button 
                    type="button"
                    onClick={() => searchAlternativeImages(`${watch('title')} game cover art`)}
                    className="flex-1 bg-[#151a32] border border-dashed border-[#00eefc]/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-[#00eefc] hover:bg-[#00eefc]/5 transition-all text-[#00eefc] group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#00eefc]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Search size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Buscar Capa</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-[#151a32] border border-dashed border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-white hover:bg-white/5 transition-all text-white group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Fazer Upload</span>
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              )}

              {showImageSelector && (
                <div className="bg-[#151a32] rounded-3xl p-6 border border-[#00eefc]/20 mb-6 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-[#00eefc] uppercase tracking-widest">Pesquisa de Capa</h3>
                    <button onClick={() => setShowImageSelector(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
                  </div>

                  <div className="relative group">
                    <input 
                      type="text" 
                      value={imageSearchQuery}
                      onChange={(e) => setImageSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          searchAlternativeImages(imageSearchQuery);
                        }
                      }}
                      placeholder="Pesquisar nova imagem..." 
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 outline-none focus:border-[#00eefc] transition-all text-sm text-white"
                    />
                    <button 
                      type="button"
                      onClick={() => searchAlternativeImages(imageSearchQuery)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#00eefc]/10 text-[#00eefc] p-1.5 rounded-lg hover:bg-[#00eefc] hover:text-[#0d1229] transition-all"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                  
                  {isSearchingImages ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <Loader2 className="animate-spin text-[#00eefc]" size={32} />
                      <p className="text-xs text-slate-400 font-medium">Buscando artes épicas...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-[#00eefc]/20">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-[3/4] relative rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-[#00eefc] transition-all bg-white/5 flex flex-col items-center justify-center gap-2 group"
                        >
                          <Upload size={24} className="text-[#00eefc] group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 text-center px-1">Upload Local</span>
                        </button>
                        {imageOptions.map((img, i) => (
                          <button 
                            key={i}
                            type="button"
                            onClick={() => {
                              setValue('image', img.url);
                              setShowImageSelector(false);
                            }}
                            className="flex flex-col gap-1.5 group/result"
                          >
                            <div className="aspect-[3/4] relative w-full rounded-xl overflow-hidden border-2 border-transparent group-hover/result:border-[#00eefc] transition-all bg-[#0d1229]">
                              <Image 
                                src={img.url} 
                                alt={`Option ${i}`} 
                                fill 
                                unoptimized
                                className="object-cover" 
                                onError={(e) => (e.currentTarget.src = `https://picsum.photos/seed/alt-${i}/200/300`)} 
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/result:opacity-100 transition-opacity flex items-center justify-center">
                                <PlusCircle size={32} className="text-[#00eefc]" />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 overflow-hidden">
                              <Search size={8} className="text-[#00eefc] flex-shrink-0" />
                              <span className="text-[7px] text-[#948f98] font-bold uppercase tracking-widest truncate">{img.source}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {!isExtendedSearch && imageOptions.length > 0 && (
                        <div className="pt-2 text-center border-t border-white/5">
                          <button 
                            type="button"
                            onClick={() => searchAlternativeImages(imageSearchQuery, true)}
                            className="text-[#00eefc] text-[10px] font-bold uppercase tracking-widest hover:underline flex items-center justify-center gap-2 mx-auto"
                          >
                            <Sparkles size={12} />
                            Não encontrou? Tente Busca Ampliada (Outras fontes)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit(onSave)} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#948f98] mb-1">Título</label>
                    <input 
                      {...register('title')}
                      className="w-full bg-[#151a32] border border-white/10 rounded-xl px-4 py-3 focus:border-[#00eefc] outline-none text-white transition-all font-medium" 
                    />
                    {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#948f98] mb-1">Plataforma</label>
                      <select 
                        {...register('platform')}
                        className="w-full bg-[#151a32] border border-white/10 rounded-xl px-4 py-3 focus:border-[#00eefc] outline-none text-white transition-all appearance-none"
                      >
                        <option value="PC">PC</option>
                        <option value="PS5">PlayStation 5</option>
                        <option value="Xbox">Xbox Series X|S</option>
                        <option value="Switch">Nintendo Switch</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#948f98] mb-1">Status</label>
                      <select 
                        {...register('status')}
                        className="w-full bg-[#151a32] border border-white/10 rounded-xl px-4 py-3 focus:border-[#00eefc] outline-none text-white transition-all appearance-none"
                      >
                        <option value="Jogando">Jogando</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Zerado">Zerado</option>
                        <option value="Abandonado">Abandonado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#948f98] mb-1">Nota (0-10)</label>
                      <input type="number" step="0.1" {...register('rating')} className="w-full bg-[#151a32] border border-white/10 rounded-xl px-4 py-3 focus:border-[#00eefc] outline-none text-white transition-all font-medium" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#948f98] mb-1">URL da Imagem</label>
                      <input {...register('image')} placeholder="https://..." className="w-full bg-[#151a32] border border-white/10 rounded-xl px-4 py-3 focus:border-[#00eefc] outline-none text-white transition-all text-xs" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#948f98] mb-1">Descrição do Jogo</label>
                    <textarea 
                      {...register('description')} 
                      placeholder="Sobre o jogo..." 
                      className="w-full bg-[#151a32] border border-white/10 rounded-xl px-4 py-3 focus:border-[#00eefc] outline-none text-white transition-all text-sm min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-[#00eefc] text-[#0d0221] font-bold py-4 rounded-2xl shadow-[0_0_30px_rgba(0,238,252,0.5)] hover:shadow-[0_0_40px_rgba(0,238,252,0.7)] transition-all mt-6 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <PlusCircle size={20} />
                  {initialData ? 'SALVAR ALTERAÇÕES' : 'SALVAR NO MEU COFRE'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const NavBar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const tabs = [
    { id: 'home', label: 'Início', icon: LayoutDashboard },
    { id: 'library', label: 'Biblioteca', icon: Library },
    { id: 'profile', label: 'Perfil', icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#0d0221]/90 backdrop-blur-lg border-t border-[#00eefc]/30 rounded-t-2xl px-4 pb-6 pt-3 flex justify-around items-center shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center justify-center transition-all active:scale-90 ${
            activeTab === tab.id 
              ? 'text-[#00eefc] drop-shadow-[0_0_10px_rgba(0,238,252,0.6)] bg-[#00eefc]/10 rounded-xl px-3 py-1' 
              : 'text-[#948f98] hover:text-[#00e38b]'
          }`}
        >
          <tab.icon size={24} />
          <span className="font-space text-[10px] font-bold uppercase tracking-widest mt-1">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

const Header = ({ 
  user, 
  logOut, 
  signIn, 
  isLoggingIn, 
  isInstallable, 
  onInstall,
  onShowCredits
}: { 
  user: User | null, 
  logOut: () => void, 
  signIn: () => void, 
  isLoggingIn: boolean,
  isInstallable: boolean,
  onInstall: () => void,
  onShowCredits: () => void
}) => (
  <header className="fixed top-0 z-50 w-full bg-[#0d0221]/80 backdrop-blur-md border-b border-[#00eefc]/20 px-6 py-4 flex justify-between items-center shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#00dbe9]">
        <Image 
          src={user?.user_metadata?.avatar_url || "https://picsum.photos/seed/avatar/200/200"} 
          alt="Avatar" 
          width={40} 
          height={40} 
          className="object-cover"
        />
      </div>
      <h1 className="text-xl font-space font-bold italic text-[#00dbe9] tracking-tighter drop-shadow-[0_0_8px_rgba(0,219,233,0.8)] uppercase">GAMEVAULT</h1>
    </div>
    <div className="flex items-center gap-4 md:gap-6">
      {isInstallable && (
        <button 
          onClick={onInstall}
          className="text-[#00eefc] hover:text-[#00e38b] transition-all flex items-center gap-2 text-sm font-bold animate-pulse group"
          title="Instalar GameVault"
        >
          <FileDown size={20} className="group-hover:scale-110 transition-transform" />
          <span className="hidden md:inline">INSTALAR</span>
        </button>
      )}
      {user ? (
        <button onClick={logOut} className="text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2 text-sm font-bold">
          <LogOut size={20} />
          <span className="hidden sm:inline">SAIR</span>
        </button>
      ) : (
        <button 
          onClick={signIn} 
          disabled={isLoggingIn}
          className={`text-[#00eefc] hover:text-[#00e38b] transition-colors flex items-center gap-2 text-sm font-bold ${isLoggingIn ? 'opacity-50 cursor-wait' : ''}`}
        >
          {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
          {isLoggingIn ? '...' : 'ENTRAR'}
        </button>
      )}
      <button 
        onClick={onShowCredits}
        className="text-[#d1bfe9] hover:text-[#00eefc] transition-colors p-2"
        title="Créditos"
      >
        <ShieldAlert size={20} />
      </button>
    </div>
  </header>
);

// --- Views ---

const HomeView = ({ games, onSelect, setActiveTab }: { games: Game[], user: User | null, onSelect: (g: Game) => void, setActiveTab: (t: string) => void }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [homeSearch, setHomeSearch] = useState('');
  const itemsPerPage = 12;
  
  const totalGames = games.length;
  const filteredGames = useMemo(() => {
    if (!homeSearch) return games;
    const lower = homeSearch.toLowerCase();
    return games.filter(g => 
      g.title.toLowerCase().includes(lower) || 
      g.platform.toLowerCase().includes(lower)
    );
  }, [games, homeSearch]);

  const totalFiltered = filteredGames.length;
  const paginatedGames = filteredGames.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
  
  const completedGames = games.filter(g => g.status === 'Zerado').length;
  const wishlist = games.filter(g => g.status === 'Pendente').length;

  const stats = [
    { label: 'TOTAL DE JOGOS', value: totalGames, icon: TrendingUp, color: 'text-[#00eefc]' },
    { label: 'CONCLUÍDOS', value: completedGames, subValue: `/ ${totalGames}`, icon: null, color: 'text-[#00e38b]' },
    { label: 'NA LISTA', value: wishlist, icon: Bookmark, color: 'text-[#00eefc]' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-xl flex flex-col justify-between">
            <span className="text-[#948f98] font-space text-[10px] font-bold tracking-widest">{stat.label}</span>
            <div className="mt-2 flex items-end gap-1">
              <span className={`text-3xl font-space font-bold ${stat.color}`}>{stat.value}</span>
              {stat.subValue && <span className="text-[#948f98] text-[14px] mb-1">{stat.subValue}</span>}
              {stat.icon && (() => {
                const StatIcon = stat.icon;
                return <StatIcon className={`${stat.color} mb-1`} size={18} />;
              })()}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-4">
          <div className="flex items-center gap-4">
             <h2 className="font-space text-3xl font-bold tracking-tight text-white uppercase">Meus Jogos</h2>
             <div className="w-2 h-2 rounded-full bg-[#00eefc] shadow-[0_0_10px_rgba(0,238,252,0.8)]" />
          </div>
          
          <div className="flex flex-1 max-w-md relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00eefc] transition-colors" size={16} />
            <input 
              type="text" 
              value={homeSearch}
              onChange={(e) => {
                setHomeSearch(e.target.value);
                setCurrentPage(0);
              }}
              placeholder="Buscar no cofre..."
              className="w-full bg-[#151a32] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-[#00eefc] transition-all text-white"
            />
          </div>

          <span className="text-[12px] font-bold text-[#00eefc] bg-[#00eefc]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            Página {currentPage + 1} de {totalPages || 1}
          </span>
        </div>

        {totalGames > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {paginatedGames.map((game) => (
              <div 
                key={game.id} 
                onClick={() => onSelect(game)}
                className="glass-card rounded-2xl overflow-hidden group cursor-pointer border border-white/5 hover:border-[#00eefc]/50 transition-all flex flex-col bg-[#151a32]/20"
              >
                <div className="aspect-[3/4] relative">
                  <Image 
                    src={game.image || `https://picsum.photos/seed/${game.id}/400/600`}
                    alt={game.title}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://picsum.photos/seed/${game.id}/400/600`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1229] via-transparent to-transparent opacity-80"></div>
                  <div className="absolute top-2 right-2">
                    <span className={`text-[8px] font-bold px-2 py-1 rounded-full backdrop-blur-md border ${game.status === 'Jogando' ? 'bg-[#00e38b]/20 text-[#00e38b] border-[#00e38b]/30' : game.status === 'Zerado' ? 'bg-[#00eefc]/20 text-[#00eefc] border-[#00eefc]/30' : game.status === 'Abandonado' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-slate-500/20 text-slate-300 border-white/10'}`}>
                      {game.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-[14px] font-space font-bold text-white truncate group-hover:text-[#00eefc] transition-colors">{game.title}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">{game.platform}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel p-20 rounded-3xl text-center border-dashed border-2 border-white/5 flex flex-col items-center gap-4">
             <Trophy size={48} className="text-slate-600 opacity-20" />
             <p className="text-slate-500 font-space font-medium">Sua coleção está vazia. Comece adicionando um jogo!</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 pt-10">
            <button 
              disabled={currentPage === 0}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="bg-[#151a32] border border-white/10 text-white p-3 rounded-xl hover:border-[#00eefc] disabled:opacity-30 disabled:hover:border-white/10 transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex gap-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-10 h-10 rounded-xl font-bold transition-all border ${currentPage === i ? 'bg-[#00eefc] text-[#0d1229] border-[#00eefc]' : 'bg-[#151a32] text-slate-400 border-white/10 hover:border-[#00eefc]/50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              disabled={currentPage === totalPages - 1}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="bg-[#151a32] border border-white/10 text-white p-3 rounded-xl hover:border-[#00eefc] disabled:opacity-30 disabled:hover:border-white/10 transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-panel p-8 rounded-3xl space-y-6 bg-gradient-to-br from-[#151a32]/40 to-transparent border border-white/5 relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy size={120} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="text-[11px] text-[#00eefc] font-bold uppercase tracking-[0.2em]">Nível do Cofre</h4>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-space font-bold text-white tracking-tighter">LVL {Math.floor(((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) / 1000) + 1}</span>
                <span className="text-slate-500 font-bold text-sm uppercase tracking-widest">Master</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experiência do Jogador</span>
                <span className="text-[10px] font-bold text-[#00e38b] uppercase tracking-widest">
                  {((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) % 1000} / 1000 XP
                </span>
              </div>
              <div className="h-4 bg-[#0d1229] rounded-full overflow-hidden border border-white/5 p-1">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) % 1000) / 10}%` }}
                  className="h-full bg-gradient-to-r from-[#00eefc] to-[#00e38b] rounded-full shadow-[0_0_15px_rgba(0,238,252,0.4)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#00eefc]" />
                <p className="text-[11px] text-slate-500 font-medium italic">Faltam {1000 - (((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) % 1000)} XP para o próximo nível épico.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">XP Coleção</p>
                <div className="flex items-center gap-2">
                  <Library size={14} className="text-slate-400" />
                  <p className="text-lg font-bold text-white">+{games.length * 50}</p>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">XP Vitórias</p>
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-[#00e38b]" />
                  <p className="text-lg font-bold text-[#00e38b]">+{games.filter(g => g.status === 'Zerado').length * 200}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl flex flex-col justify-center gap-6 border border-white/5 relative group overflow-hidden">
           <div className="absolute inset-0 bg-[#00eefc]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="flex items-center gap-4">
             <div className="w-16 h-16 rounded-2xl bg-[#00eefc]/10 flex items-center justify-center text-[#00eefc] border border-[#00eefc]/20 group-hover:rotate-12 transition-transform">
                <Medal size={32} />
             </div>
             <div>
                <h3 className="text-lg font-space font-bold text-white uppercase tracking-tight">Cofre de Conquistas</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{ACHIEVEMENTS.filter(a => a.condition(games)).length} / {ACHIEVEMENTS.length} Desbloqueadas</p>
             </div>
           </div>
           
            <div className="grid grid-cols-4 gap-3">
              {ACHIEVEMENTS.map(achievement => {
                const isUnlocked = achievement.condition(games);
                const AchievementIcon = achievement.icon;
                return (
                  <div 
                    key={achievement.id} 
                    className={`aspect-square rounded-xl flex items-center justify-center border transition-all duration-500 ${
                      isUnlocked 
                        ? 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/30 shadow-[0_0_15px_rgba(0,238,252,0.2)]' 
                        : 'bg-white/5 text-slate-700 border-white/5 opacity-50'
                    }`}
                    title={achievement.title}
                  >
                    <AchievementIcon size={20} />
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setActiveTab('profile')}
              className="w-full mt-2 py-3 rounded-xl border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              Ver Todas Conquistas
              <ChevronRight size={14} />
            </button>
        </div>
      </div>
    </motion.div>
  );
};

const LibraryView = ({ 
  games, 
  onSelect, 
  onEdit, 
  onDelete,
  deletingId
}: { 
  games: Game[], 
  onSelect: (g: Game) => void, 
  onEdit: (g: Game) => void, 
  onDelete: (id: string) => void,
  deletingId: string | null
}) => {
  const [filter, setFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setBy] = useState<'date' | 'rating' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredGames = useMemo(() => {
    let result = filter === 'Todos' ? [...games] : games.filter(g => g.status === filter);
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(g => 
        g.title.toLowerCase().includes(lowerSearch) || 
        g.platform.toLowerCase().includes(lowerSearch)
      );
    }
    
    result.sort((a, b) => {
      if (sortBy === 'date') {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }
      if (sortBy === 'rating') {
        return sortOrder === 'desc' ? b.rating - a.rating : a.rating - b.rating;
      }
      if (sortBy === 'title') {
        return sortOrder === 'asc' 
          ? a.title.localeCompare(b.title) 
          : b.title.localeCompare(a.title);
      }
      return 0;
    });

    return result;
  }, [games, filter, sortBy, sortOrder]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Meu Cofre de Jogos', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Lista de Jogos - Categoria: ${filter}`, 14, 30);
    doc.text(`Total: ${filteredGames.length} jogos`, 14, 36);

    const tableData = filteredGames.map(game => [
      game.title,
      game.platform,
      game.status,
      game.rating.toString()
    ]);

    autoTable(doc, {
      head: [['Título', 'Plataforma', 'Status', 'Nota']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 238, 252], textColor: [13, 18, 41] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    doc.save(`meu-cofre-jogos-${filter.toLowerCase()}.pdf`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex-1 max-w-2xl">
          <h2 className="text-4xl font-space font-bold text-[#d1bfe9] mb-6">Sua Biblioteca</h2>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#948f98] group-focus-within:text-[#00eefc] transition-colors" size={20} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Buscar em ${games.length} jogos...`} 
              className="w-full bg-[#151a32] border-b-2 border-[#49454d] focus:border-[#00eefc] outline-none py-4 pl-12 pr-4 text-lg font-medium transition-all rounded-t-lg"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                title="Limpar busca"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 pb-4 border-b border-white/5">
        <div className="flex flex-wrap gap-3">
          {['Todos', 'Jogando', 'Pendente', 'Zerado', 'Abandonado'].map((s) => (
            <button 
              key={s} 
              onClick={() => setFilter(s)}
              className={`px-6 py-2 rounded-full text-[11px] font-bold transition-all border ${filter === s ? 'bg-[#00eefc]/10 border-[#00eefc] text-[#00eefc] shadow-[0_0_10px_rgba(0,238,252,0.3)]' : 'glass-panel border-white/5 text-[#948f98] hover:text-white hover:border-white/20'}`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/10">
            <button 
              onClick={() => { setBy('date'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 ${sortBy === 'date' ? 'bg-[#00eefc] text-[#0d1229]' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar size={12} />
              DATA {sortBy === 'date' && (sortOrder === 'desc' ? '▼' : '▲')}
            </button>
            <button 
              onClick={() => { setBy('rating'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 ${sortBy === 'rating' ? 'bg-[#00eefc] text-[#0d1229]' : 'text-slate-400 hover:text-white'}`}
            >
              <Star size={12} />
              NOTA {sortBy === 'rating' && (sortOrder === 'desc' ? '▼' : '▲')}
            </button>
            <button 
              onClick={() => { setBy('title'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 ${sortBy === 'title' ? 'bg-[#00eefc] text-[#0d1229]' : 'text-slate-400 hover:text-white'}`}
            >
              <LucideType size={12} />
              A-Z {sortBy === 'title' && (sortOrder === 'asc' ? '▲' : '▼')}
            </button>
          </div>

          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-6 py-2 bg-[#00eefc]/5 hover:bg-[#00eefc]/10 text-[#00eefc] rounded-full text-[11px] font-bold border border-[#00eefc]/20 transition-all group"
          >
            <FileDown size={14} className="group-hover:scale-110 transition-transform" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {filteredGames.map((game) => (
          <div 
            key={game.id} 
            onClick={() => onSelect(game)}
            className="glass-panel rounded-2xl overflow-hidden group cursor-pointer hover:border-[#00eefc] transition-all relative"
          >
            <div className="aspect-[3/4] relative overflow-hidden">
              <Image 
                src={game.image || `https://picsum.photos/seed/${game.id}/600/800`} 
                alt={game.title} 
                fill 
                unoptimized
                className="object-cover group-hover:scale-110 transition-transform duration-500"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://picsum.photos/seed/${game.id}/600/800`;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1229] via-transparent to-transparent opacity-80"></div>
              <div className="absolute top-2 left-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded backdrop-blur-md border ${game.status === 'Jogando' ? 'bg-[#00e38b]/20 text-[#00e38b] border-[#00e38b]/30' : game.status === 'Zerado' ? 'bg-[#00eefc]/20 text-[#00eefc] border-[#00eefc]/30' : game.status === 'Abandonado' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-slate-500/20 text-slate-300 border-white/10'}`}>
                  {game.status.toUpperCase()}
                </span>
              </div>
              <div className="absolute top-2 right-2 flex flex-col gap-2 z-10">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(game);
                  }} 
                  className="bg-[#191e36]/80 p-2.5 rounded-lg hover:bg-[#00eefc] hover:text-[#0d1229] transition-all backdrop-blur-sm border border-white/10 shadow-lg"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  disabled={deletingId === game.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(game.id);
                  }} 
                  className={`bg-[#191e36]/80 p-2.5 rounded-lg transition-all backdrop-blur-sm border border-red-500/30 shadow-lg ${deletingId === game.id ? 'opacity-50' : 'hover:bg-red-500 text-red-500 hover:text-white'}`}
                >
                  {deletingId === game.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                </button>
              </div>
            </div>
            <div className="p-4 bg-[#151a32]/40 backdrop-blur-md">
              <h4 className="font-space font-bold text-[13px] truncate mb-1 text-white">{game.title}</h4>
              <div className="flex justify-between items-center text-[10px] text-[#948f98]">
                <span>{game.platform}</span>
                <div className="flex items-center gap-1">
                  <Star size={10} fill="currentColor" className="text-[#00eefc]" />
                  <span>{game.rating}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredGames.length === 0 && (
          <div className="col-span-full py-20 text-center glass-panel rounded-2xl border-dashed border-2 border-white/5">
            <p className="text-slate-500">Nenhum jogo encontrado nesta categoria.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const GameDetailsView = ({ 
  game, 
  onBack, 
  onEdit, 
  onDelete,
  deletingId
}: { 
  game: Game, 
  onBack: () => void, 
  onEdit: (g: Game) => void, 
  onDelete: (id: string) => void,
  deletingId: string | null
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-[#00eefc] transition-colors font-space text-sm font-bold uppercase tracking-widest mb-4 group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        Voltar para a Coleção
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1">
          <div className="aspect-[3/4] relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <Image 
              src={game.image || `https://picsum.photos/seed/${game.id}/600/800`}
              alt={game.title}
              fill
              unoptimized
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://picsum.photos/seed/${game.id}/600/800`;
              }}
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-4 py-1 rounded-full text-[10px] font-bold border ${
                game.status === 'Jogando' ? 'bg-[#00e38b]/20 text-[#00e38b] border-[#00e38b]/30' : 
                game.status === 'Zerado' ? 'bg-[#00eefc]/20 text-[#00eefc] border-[#00eefc]/30' : 
                game.status === 'Abandonado' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                'bg-slate-500/20 text-slate-300 border-white/10'
              }`}>
                {game.status.toUpperCase()}
              </span>
              <span className="bg-white/5 px-4 py-1 rounded-full text-[10px] font-bold text-slate-400 border border-white/10">
                {game.platform.toUpperCase()}
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-space font-bold text-white leading-none tracking-tight">{game.title}</h2>
            <div className="flex items-center gap-2 text-[#00eefc]">
              <Star size={20} fill="currentColor" />
              <span className="text-2xl font-space font-bold">{game.rating}</span>
              <span className="text-slate-500 text-sm font-medium">/ 10</span>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl space-y-4 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <LucideType size={100} />
            </div>
            <h3 className="text-[10px] font-bold text-[#00eefc] uppercase tracking-widest flex items-center gap-2">
              < LucideType size={14} />
              Sobre o Jogo
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {game.description || "Nenhuma descrição disponível para este título. Clique em editar para adicionar informações sobre o jogo."}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={() => onEdit(game)}
              className="bg-[#00eefc] text-[#0d1229] px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(0,238,252,0.4)]"
            >
              <Edit2 size={20} />
              EDITAR JOGO
            </button>
            <button 
              disabled={deletingId === game.id}
              onClick={() => onDelete(game.id)}
              className={`px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all border ${deletingId === game.id ? 'bg-red-500/5 text-red-500/50 border-red-500/10 cursor-not-allowed' : 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white'}`}
            >
              {deletingId === game.id ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
              {deletingId === game.id ? 'EXCLUINDO...' : 'EXCLUIR JOGO'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
            <div className="glass-panel p-6 rounded-3xl space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} />
                Adicionado em
              </p>
              <p className="text-white font-medium">
                {new Date(game.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="glass-panel p-6 rounded-3xl space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <LayoutDashboard size={14} />
                Última Atualização
              </p>
              <p className="text-white font-medium">
                {new Date(game.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const TrophyCelebration = ({ 
  achievement, 
  onClose 
}: { 
  achievement: Achievement, 
  onClose: () => void 
}) => {
  const Icon = achievement.icon;
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0d1229]/95 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.5, y: 100, rotate: -10 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 100 }}
        className="w-full max-w-lg bg-gradient-to-br from-[#1a1f3c] to-[#0d1229] border-2 border-[#00eefc] rounded-[40px] p-12 text-center relative overflow-hidden shadow-[0_0_100px_rgba(0,238,252,0.3)]"
      >
        {/* Animated background elements */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-24 -right-24 w-64 h-64 bg-[#00eefc]/10 rounded-full blur-3xl shadow-[0_0_50px_rgba(0,238,252,0.2)]"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#d1bfe9]/10 rounded-full blur-3xl shadow-[0_0_50px_rgba(209,191,233,0.2)]"
        />

        <div className="relative z-10 space-y-8">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center"
          >
            <div className="w-24 h-24 rounded-full bg-[#00eefc] flex items-center justify-center text-[#0d1229] mb-6 shadow-[0_0_30px_rgba(0,238,252,0.5)]">
              <Trophy size={48} />
            </div>
            <h2 className="text-sm font-bold text-[#00eefc] uppercase tracking-[0.3em] mb-2">Conquista Desbloqueada!</h2>
            <h3 className="text-5xl font-space font-bold text-white leading-tight mb-4">{achievement.title}</h3>
            <p className="text-lg text-slate-400 font-medium max-w-xs mx-auto">{achievement.description}</p>
          </motion.div>

          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl mx-auto flex items-center justify-center text-white"
          >
            <Icon size={40} />
          </motion.div>

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full bg-white text-[#0d1229] py-5 rounded-2xl font-space font-bold text-lg uppercase tracking-widest shadow-xl hover:bg-[#00eefc] transition-colors"
          >
            Voltar ao Início
          </motion.button>
        </div>
      </motion.div>
      
      {/* Confetti effect simulation */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            top: "50%", 
            left: "50%", 
            scale: 0,
            x: 0,
            y: 0 
          }}
          animate={{ 
            x: (Math.random() - 0.5) * 800,
            y: (Math.random() - 0.5) * 800,
            scale: [0, 1, 0],
            rotate: Math.random() * 360
          }}
          transition={{ 
            duration: 2 + Math.random(), 
            repeat: Infinity,
            delay: Math.random() * 1
          }}
          className="absolute w-4 h-4 rounded-sm pointer-events-none"
          style={{ 
            backgroundColor: i % 2 === 0 ? '#00eefc' : '#d1bfe9'
          }}
        />
      ))}
    </motion.div>
  );
};

const CreditsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#1a1f3c] border border-[#00eefc]/30 rounded-[32px] p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Background Decorations */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#00eefc]/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#d1bfe9]/5 rounded-full blur-3xl" />
            
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-sm font-bold text-[#00eefc] uppercase tracking-[0.2em] mb-1">Sobre o App</h2>
                  <h3 className="text-3xl font-space font-bold text-white uppercase italic tracking-tighter">CRÉDITOS</h3>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <UserIcon size={12} /> Desenvolvedor
                  </p>
                  <p className="text-lg font-bold text-white mb-1">Gustavo Liarte</p>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Mail size={14} className="text-[#00eefc]" />
                    gliarte@gmail.com
                  </p>
                </div>

                <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <ShieldAlert size={12} /> Aviso Legal
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    &quot;A utilização é livre, mas não nos responsabilizamos pela perda de dados.&quot;
                  </p>
                </div>
              </div>

              {/* Diagnóstico de Sistema (Crucial para o Editor) */}
              {typeof window !== 'undefined' && (
                <div className={`mt-4 p-4 rounded-xl border backdrop-blur-md transition-all ${
                  (process.env.NEXT_PUBLIC_GEMINI_API_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder'))
                    ? "bg-green-500/5 border-green-500/20" 
                    : "bg-red-500/5 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                }`}>
                  <p className="text-[10px] font-bold text-[#00eefc] mb-3 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${(process.env.NEXT_PUBLIC_GEMINI_API_KEY) ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
                    CONEXÕES DO COFRE:
                  </p>
                  
                  <div className="space-y-3">
                    {/* IA Status */}
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                      <span className="text-[10px] text-[#948f98] uppercase">Inteligência Artificial:</span>
                      <span className={`text-[10px] font-bold ${process.env.NEXT_PUBLIC_GEMINI_API_KEY ? "text-green-400" : "text-amber-400"}`}>
                        {process.env.NEXT_PUBLIC_GEMINI_API_KEY ? "PRONTA ✓" : "AUSENTE ✗"}
                      </span>
                    </div>

                    {/* DB Status */}
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                      <span className="text-[10px] text-[#948f98] uppercase">Banco de Dados (SQL):</span>
                      <span className={`text-[10px] font-bold ${
                        (currentOrigin && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')) 
                        ? "text-green-400" : "text-red-400"
                      }`}>
                        {(currentOrigin && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder')) 
                          ? "CONECTADO ✓" : "DESCONECTADO ✗"}
                      </span>
                    </div>

                    {/* Reorganized Help Section */}
                    <div className="space-y-2">
                      {(!process.env.NEXT_PUBLIC_GEMINI_API_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) && (
                        <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20 space-y-1">
                          <p className="text-[9px] text-red-400 font-bold uppercase">Ações Necessárias:</p>
                          <ol className="text-[9px] text-slate-300 list-decimal ml-4 space-y-1">
                            {!process.env.NEXT_PUBLIC_GEMINI_API_KEY && (
                              <li>IA: Obtenha chave em <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#00eefc] underline px-1">aistudio.google.com</a> e adicione nos Settings &gt; Secrets</li>
                            )}
                            {(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder') || !process.env.NEXT_PUBLIC_SUPABASE_URL) && (
                              <li>SQL: Adicione chaves Supabase nos Secrets.</li>
                            )}
                          </ol>
                        </div>
                      )}

                      <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5">
                        <p className="text-[9px] text-[#00eefc] font-bold uppercase tracking-wider flex items-center gap-1">
                          <ShieldAlert size={10} /> Dicas do Sistema:
                        </p>
                        <ul className="text-[9px] text-slate-400 space-y-1 list-disc ml-4">
                          <li>Login usa POP-UP. Verifique se o navegador bloqueou a janela.</li>
                          <li>Para editar código via terminal, use <span className="text-white font-mono">git commit -m &apos;msg&apos;</span> para evitar erro de editor no macOS/Web.</li>
                          <li>Se o app travar ou der erro 403, use o botão &quot;Open in New Tab&quot; acima.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-space">
                  GameVault v1.3 • AI Diagnostic HUD
                </p>
              </div>

              <div className="pt-4 flex flex-col items-center gap-3">
                <div className="w-12 h-1 bg-gradient-to-r from-transparent via-[#00eefc]/50 to-transparent rounded-full mb-2" />
                <p className="text-[10px] font-bold text-[#948f98] uppercase tracking-[0.3em]">GameVault v1.0</p>
                <button 
                  onClick={() => {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                        for (const registration of registrations) {
                          registration.unregister();
                        }
                        window.location.reload();
                      });
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="text-[10px] text-[#00eefc]/50 hover:text-[#00eefc] transition-colors flex items-center gap-1"
                >
                  FORÇAR ATUALIZAÇÃO (LIMPAR CACHE)
                </button>
              </div>

              <button 
                onClick={onClose}
                className="w-full bg-[#0d1229] hover:bg-[#00eefc] text-white hover:text-[#0d1229] py-4 rounded-xl font-bold transition-all border border-[#00eefc]/30 uppercase tracking-widest text-sm"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [gameToRemove, setGameToRemove] = useState<Game | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  // Trophies state
  const [celebratingAchievement, setCelebratingAchievement] = useState<Achievement | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[] | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register simple service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(
          function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          },
          function(err) {
            console.warn('ServiceWorker registration failed: ', err);
          }
        );
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    setCurrentOrigin(window.location.origin);

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsLoggingIn(false);
      }
    });

    // Listener para o callback de autenticação (caso popup)
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        setUser(event.data.session.user);
        setIsLoggingIn(false);
        showToast("Bem-vindo!", "success");
      }
      if (event.data?.type === 'SUPABASE_AUTH_ERROR') {
        showToast(event.data.message || "Erro na autenticação", "error");
        setIsLoggingIn(false);
      }
    };
    window.addEventListener('message', handleAuthMessage);

    // Listener para o localStorage (caso cross-tab/popup em navegadores que bloqueiam postMessage)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase-auth-event') {
        try {
          const authData = JSON.parse(e.newValue || '{}');
          if (authData.type === 'SUPABASE_AUTH_SUCCESS') {
            setUser(authData.session.user);
            setIsLoggingIn(false);
            showToast("Bem-vindo!", "success");
            localStorage.removeItem('supabase-auth-event');
          }
        } catch (err) {
          console.error("Erro ao tratar evento de storage auth:", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router]);

  useEffect(() => {
    if (user && games.length > 0 && unlockedAchievements !== null) {
      const activeAchievements = ACHIEVEMENTS.filter(a => a.condition(games));
      const newlyUnlocked = activeAchievements.filter(a => !unlockedAchievements.includes(a.id));
      
      if (newlyUnlocked.length > 0) {
        // Unlocked first new one
        const achievement = newlyUnlocked[0];
        setCelebratingAchievement(achievement);
        setUnlockedAchievements(prev => [...(prev || []), ...newlyUnlocked.map(a => a.id)]);
        
        // Play sound - wrap in try/catch and check if user interacted
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => {
            console.warn("Audio play blocked by browser policy - usually requires user interaction.");
          });
        }
      }
    }
  }, [games, user, unlockedAchievements]);

  useEffect(() => {
    // Initial fetch of unlocked achievements to avoid re-celebrating what was already earned
    if (user && games.length > 0 && unlockedAchievements === null) {
      const alreadyEarned = ACHIEVEMENTS.filter(a => a.condition(games)).map(a => a.id);
      setUnlockedAchievements(alreadyEarned);
    }
  }, [user, games, unlockedAchievements]);

  useEffect(() => {
    if (user) {
      const fetchGames = async () => {
        try {
          const data = await gameService.getGames();
          setGames(data as Game[]);
        } catch (error) {
          console.error("Error fetching games:", error);
        }
      };
      
      fetchGames();

      const channel = supabase
        .channel('games_realtime')
        .on('postgres_changes', { event: '*', table: 'games', filter: `owner_id=eq.${user.id}` }, () => {
          fetchGames();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setGames([]);
    }
  }, [user]);

  const signIn = async () => {
    setIsLoggingIn(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false // Usando redirecionamento direto para maior compatibilidade Vercel
        },
      });
      
      if (error) throw error;
      
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Auth exception details:", error);
      showToast(error.message || "Erro ao iniciar login.", "error");
      setIsLoggingIn(false);
    }
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveGame = async (data: GameFormData) => {
    if (!user) return;

    try {
      if (editingGame) {
        await gameService.updateGame(editingGame.id, {
          title: data.title,
          platform: data.platform,
          status: data.status,
          rating: data.rating,
          image: data.image,
          description: data.description,
          updated_at: new Date().toISOString()
        });
      } else {
        await gameService.addGame({
          owner_id: user.id,
          title: data.title,
          platform: data.platform,
          status: data.status,
          rating: data.rating,
          image: data.image || '',
          description: data.description || '',
        });
      }
      setIsModalOpen(false);
      setEditingGame(null);
      showToast(editingGame ? "Jogo atualizado!" : "Jogo adicionado!");
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error saving game:", err);
      showToast(`Erro ao salvar jogo.`, "error");
    }
  };

  const handleDeleteGame = async (id: string) => {
    setDeletingId(id);
    try {
      await gameService.deleteGame(id);
      showToast("Jogo removido com sucesso!");
      if (selectedGame?.id === id) {
        setSelectedGame(null);
      }
      setGameToRemove(null);
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Erro ao deletar jogo:", err);
      showToast("Erro ao remover jogo.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const openAddModal = () => {
    setEditingGame(null);
    setIsModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGame(game);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0d1229] text-slate-100 font-sans selection:bg-[#00eefc]/30">
      {/* Audio for Trophy */}
      <audio 
        ref={audioRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3" 
        preload="auto"
      />
      
      <AnimatePresence>
        {celebratingAchievement && (
          <TrophyCelebration 
            achievement={celebratingAchievement} 
            onClose={() => {
              setCelebratingAchievement(null);
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} 
          />
        )}
      </AnimatePresence>

      <Header 
        user={user} 
        logOut={handleLogOut} 
        signIn={signIn} 
        isLoggingIn={isLoggingIn}
        isInstallable={isInstallable}
        onInstall={handleInstallClick}
        onShowCredits={() => setIsCreditsOpen(true)}
      />
      
      <main className="pt-28 pb-32 px-6 md:px-12 max-w-7xl mx-auto min-h-[80vh]">
        {!user ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center space-y-8"
          >
            <div className="w-24 h-24 bg-gradient-to-tr from-[#00dbe9] to-[#00e38b] rounded-full flex items-center justify-center blur-[1px] shadow-[0_0_50px_rgba(0,219,233,0.2)]">
              <Trophy size={48} className="text-[#0d1229]" />
            </div>
            <div className="max-w-md space-y-4">
              <h2 className="text-4xl font-space font-bold text-white uppercase tracking-tight">Bem-vindo ao GameVault</h2>
              <p className="text-slate-400">Entre na sua conta para começar a gerenciar sua biblioteca de jogos e acompanhar seu progresso de forma épica.</p>
            </div>
            <button 
              onClick={signIn}
              disabled={isLoggingIn}
              className={`bg-[#00eefc] text-[#0d1229] px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(0,238,252,0.4)] flex items-center gap-3 ${isLoggingIn ? 'opacity-70 cursor-wait' : 'hover:scale-105 active:scale-95'}`}
            >
              {isLoggingIn ? <Loader2 className="animate-spin" size={24} /> : <LogIn size={24} />}
              {isLoggingIn ? 'AUTENTICANDO...' : 'ENTRAR NO GAMEVAULT'}
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {selectedGame ? (
              <GameDetailsView 
                key="details"
                game={selectedGame} 
                onBack={() => setSelectedGame(null)} 
                onEdit={openEditModal} 
                onDelete={() => {
                  if (selectedGame) setGameToRemove(selectedGame);
                }} 
                deletingId={deletingId}
              />
            ) : (
              <>
                {activeTab === 'home' && <HomeView games={games} user={user} onSelect={setSelectedGame} setActiveTab={setActiveTab} key="home" />}
                {activeTab === 'library' && (
                  <LibraryView 
                    games={games} 
                    onSelect={setSelectedGame} 
                    onEdit={openEditModal} 
                    onDelete={(id) => {
                      const game = games.find(g => g.id === id);
                      if (game) setGameToRemove(game);
                    }} 
                    deletingId={deletingId}
                    key="library" 
                  />
                )}
                {activeTab === 'profile' && (
                  <motion.div 
                    key="profile"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="max-w-2xl mx-auto space-y-10"
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#00dbe9] shadow-[0_0_30px_rgba(0,219,233,0.3)]">
                         <Image 
                          src={user.user_metadata?.avatar_url || "https://picsum.photos/seed/avatar2/300/300"} 
                          alt="Profile" 
                          width={128} 
                          height={128} 
                          className="object-cover"
                        />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-4xl font-space font-bold text-white">{user.user_metadata?.full_name || user.email}</h2>
                        <p className="text-[#00e38b] font-space text-sm tracking-widest font-bold uppercase">
                          MEMBRO ELITE • LVL {Math.floor(((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) / 1000) + 1}
                        </p>
                        <div className="flex gap-4 pt-2 justify-center sm:justify-start">
                          <div className="text-center">
                            <p className="text-xl font-bold text-white">{games.length}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Jogos</p>
                          </div>
                          <div className="h-8 w-px bg-white/10" />
                          <div className="text-center">
                            <p className="text-xl font-bold text-[#00e38b]">{games.filter(g => g.status === 'Zerado').length}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Zerados</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-panel p-8 rounded-3xl space-y-6 border border-white/5 relative overflow-hidden">
                         <h3 className="text-lg font-space font-bold flex items-center gap-2 text-white">
                          <TrendingUp size={20} className="text-[#00eefc]" />
                          Progresso do Cofre
                         </h3>
                         <div className="space-y-4">
                            <div className="flex justify-between items-end">
                              <span className="text-3xl font-space font-bold text-white">LVL {Math.floor(((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) / 1000) + 1}</span>
                              <span className="text-[10px] font-bold text-[#00e38b] uppercase tracking-widest">
                                {((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) % 1000} / 1000 XP
                              </span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#00eefc] to-[#00e38b]" 
                                style={{ width: `${(((games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)) % 1000) / 10}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="space-y-1">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Jogos na Base</p>
                                <p className="text-lg font-bold text-white">{games.length}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Total XP</p>
                                <p className="text-lg font-bold text-[#00eefc]">{(games.length * 50) + (games.filter(g => g.status === 'Zerado').length * 200)}</p>
                              </div>
                            </div>
                         </div>
                      </div>
                      <div className="glass-panel p-6 rounded-2xl space-y-4">
                         <h3 className="text-lg font-space font-bold flex items-center gap-2 text-white">
                          <Bookmark size={20} className="text-[#00eefc]" />
                          Coleção por Status
                         </h3>
                         <div className="space-y-3">
                            {['Jogando', 'Pendente', 'Zerado', 'Abandonado'].map(s => {
                              const count = games.filter(g => g.status === s).length;
                              const total = games.length || 1;
                              return (
                                <div key={s} className="space-y-1">
                                  <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                    <span>{s.toUpperCase()}</span>
                                    <span>{count}</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#00eefc]" style={{ width: `${(count / total) * 100}%` }}></div>
                                  </div>
                                </div>
                              );
                            })}
                         </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-space font-bold text-white flex items-center gap-3">
                          <Trophy size={28} className="text-[#00eefc]" />
                          CONQUISTAS DESBLOQUEADAS
                        </h3>
                        <span className="text-sm font-bold text-[#00eefc] bg-[#00eefc]/10 px-4 py-1 rounded-full border border-[#00eefc]/20">
                          {ACHIEVEMENTS.filter(a => a.condition(games)).length} / {ACHIEVEMENTS.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ACHIEVEMENTS.map(achievement => {
                          const isUnlocked = achievement.condition(games);
                          return (
                            <div 
                              key={achievement.id}
                              className={`glass-panel p-5 rounded-2xl flex items-center gap-4 border transition-all ${
                                isUnlocked 
                                  ? 'border-[#00eefc]/30 bg-gradient-to-br from-[#00eefc]/5 to-transparent' 
                                  : 'border-white/5 opacity-40 grayscale'
                              }`}
                            >
                              {(() => {
                                const AchievementIcon = achievement.icon;
                                return (
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                                    isUnlocked ? 'bg-[#00eefc]/10 text-[#00eefc] border-[#00eefc]/20' : 'bg-white/5 text-slate-500 border-white/5'
                                  }`}>
                                    <AchievementIcon size={24} />
                                  </div>
                                );
                              })()}
                              <div className="min-w-0">
                                <h4 className={`text-[13px] font-bold uppercase tracking-tight ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                                  {achievement.title}
                                </h4>
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                  {achievement.description}
                                </p>
                              </div>
                              {isUnlocked && (
                                <div className="ml-auto">
                                  <Sparkles size={14} className="text-[#00eefc]" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>
        )}
      </main>

      {user && (
        <div className={`fixed bottom-28 right-8 z-50 transition-transform ${selectedGame ? 'scale-0' : 'scale-100'}`}>
          <button 
            onClick={openAddModal}
            className="w-16 h-16 bg-[#00eefc] text-[#0d1229] rounded-full shadow-[0_0_30px_rgba(0,238,252,0.6)] flex items-center justify-center hover:scale-110 active:scale-90 transition-all group"
          >
            <PlusCircle size={32} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      )}

      <DeleteConfirmModal 
        isOpen={!!gameToRemove}
        onClose={() => setGameToRemove(null)}
        onConfirm={() => gameToRemove && handleDeleteGame(gameToRemove.id)}
        gameTitle={gameToRemove?.title || ''}
        isDeleting={!!deletingId}
      />

      <NavBar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setSelectedGame(null);
          setActiveTab(tab);
        }} 
      />
      
      <GameModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveGame}
        initialData={editingGame}
        showToast={showToast}
      />

      <CreditsModal 
        isOpen={isCreditsOpen} 
        onClose={() => setIsCreditsOpen(false)} 
      />

      {/* Floating Credits Button (Shield Icon) */}
      <button 
        onClick={() => setIsCreditsOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-[#0d1229]/90 backdrop-blur-xl border border-[#00eefc]/40 rounded-full flex items-center justify-center text-[#00eefc] hover:bg-[#00eefc] hover:text-[#0d1229] transition-all shadow-[0_0_20px_rgba(0,238,252,0.4)] group"
        title="Créditos e Aviso Legal"
      >
        <ShieldAlert size={24} className="group-hover:scale-110 transition-transform" />
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2 border ${
              toast.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-[#00e38b]/90 text-[#0d1229] border-[#00e38b]'
            }`}
          >
            {toast.type === 'error' ? <X size={18} /> : <Sparkles size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
