'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      if (!supabase) {
        console.error("Supabase client not initialized in callback");
        router.push('/');
        return;
      }
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data.session) {
            console.log("Sessão obtida, tentando comunicar com opener:", !!window.opener);
            
            // Tenta salvar no localStorage para comunicação cross-tab/window (fallback)
            try {
              localStorage.setItem('supabase-auth-event', JSON.stringify({
                type: 'SUPABASE_AUTH_SUCCESS',
                session: data.session,
                timestamp: Date.now()
              }));
            } catch (e) {
              console.error("Erro ao gravar no localStorage:", e);
            }

            if (window.opener) {
              window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS', session: data.session }, '*');
              setTimeout(() => window.close(), 500);
            } else {
              // Redirecionamento direto (Vercel/Mobile)
              router.push('/');
            }
            return;
          }
        }
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          // Fallback via localStorage
          try {
            localStorage.setItem('supabase-auth-event', JSON.stringify({
              type: 'SUPABASE_AUTH_SUCCESS', 
              session, 
              timestamp: Date.now()
            }));
          } catch {
            // Ignore storage errors on some browsers
          }

          if (window.opener) {
            window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS', session }, '*');
            setTimeout(() => window.close(), 500);
          } else {
            router.push('/');
          }
        } else {
          // Aguarda um pouco caso o supabase ainda esteja parseando o hash (flow implícito)
          setTimeout(async () => {
             const { data: { session: retrySession } } = await supabase.auth.getSession();
             if (retrySession) {
               try {
                 localStorage.setItem('supabase-auth-event', JSON.stringify({
                   type: 'SUPABASE_AUTH_SUCCESS', 
                   session: retrySession, 
                   timestamp: Date.now()
                 }));
               } catch {
                 // Ignore storage errors
               }

               if (window.opener) {
                 window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS', session: retrySession }, '*');
                 window.close();
               } else {
                 const isPopup = window.innerWidth < 800 && window.name === 'supabase_auth_popup';
                 if (isPopup) {
                   window.close();
                 } else {
                   router.push('/');
                 }
               }
             } else {
               // Se ainda não tem sessão, redireciona para home (provavelmente falha ou cancelado)
               if (!window.opener && window.name !== 'supabase_auth_popup') {
                 router.push('/');
               } else if (window.name === 'supabase_auth_popup') {
                 // Se é popup mas não tem sessão após retry, fecha
                 setTimeout(() => window.close(), 2000);
               }
             }
          }, 1500);
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Auth callback error:", error);
        if (window.opener) {
          window.opener.postMessage({ type: 'SUPABASE_AUTH_ERROR', message: error.message }, '*');
          setTimeout(() => window.close(), 3000);
        } else {
          router.push('/');
        }
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d1229] flex items-center justify-center text-white font-sans p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 border-4 border-[#00eefc] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#00eefc]">Autenticando...</h2>
          <p className="text-slate-400">Estamos processando sua entrada. Esta janela fechará automaticamente ou você poderá retornar ao aplicativo se estiver em um dispositivo móvel.</p>
        </div>
        
        <div className="pt-6 border-t border-white/10">
          <button 
            onClick={() => window.close()}
            className="text-xs text-slate-500 hover:text-white underline"
          >
            Fechar esta aba manualmete se não fechar sozinha
          </button>
        </div>
      </div>
    </div>
  );
}
