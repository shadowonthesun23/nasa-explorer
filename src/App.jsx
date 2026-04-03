import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Download, Image as ImageIcon, Video, X, ChevronDown, Loader2, Menu, Sun, Moon, Coffee, LayoutGrid, Star, ExternalLink, Languages, MousePointerClick } from 'lucide-react';

export default function App() {
  // Stato Globale App
  const [activeTab, setActiveTab] = useState('library'); // 'library' | 'apod'

  // Stato per i filtri di ricerca (Libreria)
  const [query, setQuery] = useState('Artemis');
  const [mediaType, setMediaType] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  // Stato per i risultati (Libreria)
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Stato per la Foto del Giorno (APOD)
  const [apodData, setApodData] = useState(null);
  const [apodLoading, setApodLoading] = useState(false);
  const [apodError, setApodError] = useState(null);

  // Stato per Traduzione APOD
  const [translatedApod, setTranslatedApod] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Stato per gestire il menu filtri su mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Stato per Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Reset traduzione al cambio del giorno
  useEffect(() => {
    setTranslatedApod(null);
    setShowTranslation(false);
  }, [apodData?.date]);

  // LOGICA RICERCA LIBRERIA
  const performSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedItem(null);
    setIsMobileMenuOpen(false);

    try {
      const baseUrl = 'https://images-api.nasa.gov/search';
      let items = [];
      let total = 0;

      if (!mediaType) {
        const urlImages = new URL(baseUrl);
        urlImages.searchParams.append('q', query);
        urlImages.searchParams.append('media_type', 'image');
        if (yearStart) urlImages.searchParams.append('year_start', yearStart);
        if (yearEnd) urlImages.searchParams.append('year_end', yearEnd);

        const urlVideos = new URL(baseUrl);
        urlVideos.searchParams.append('q', query);
        urlVideos.searchParams.append('media_type', 'video');
        if (yearStart) urlVideos.searchParams.append('year_start', yearStart);
        if (yearEnd) urlVideos.searchParams.append('year_end', yearEnd);

        const [resImages, resVideos] = await Promise.all([
          fetch(urlImages),
          fetch(urlVideos)
        ]);

        if (!resImages.ok || !resVideos.ok) throw new Error('Errore nella comunicazione con i server NASA');

        const dataImages = await resImages.json();
        const dataVideos = await resVideos.json();

        items = [...dataImages.collection.items, ...dataVideos.collection.items];
        total = dataImages.collection.metadata.total_hits + dataVideos.collection.metadata.total_hits;
      } else {
        const url = new URL(baseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('media_type', mediaType);
        if (yearStart) url.searchParams.append('year_start', yearStart);
        if (yearEnd) url.searchParams.append('year_end', yearEnd);

        const response = await fetch(url);
        if (!response.ok) throw new Error('Errore nella comunicazione con i server NASA');

        const data = await response.json();
        items = data.collection.items;
        total = data.collection.metadata.total_hits;
      }

      setResults(items);
      setTotalResults(total);

    } catch (err) {
      setError(err.message);
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [query, mediaType, yearStart, yearEnd]);

  useEffect(() => {
    if (activeTab === 'library' && results.length === 0 && !loading && !error) {
      performSearch();
    }
  }, [activeTab, performSearch, results.length, loading, error]);

  // LOGICA FOTO DEL GIORNO (APOD)
  useEffect(() => {
    if (activeTab === 'apod' && !apodData && !apodLoading && !apodError) {
      const fetchApod = async () => {
        setApodLoading(true);
        try {
          const res = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
          if (!res.ok) {
            if (res.status === 429) throw new Error('Limite di richieste superato. Riprova più tardi.');
            throw new Error('Impossibile recuperare la foto del giorno.');
          }
          const data = await res.json();
          setApodData(data);
        } catch (e) {
          setApodError(e.message);
        } finally {
          setApodLoading(false);
        }
      };
      fetchApod();
    }
  }, [activeTab, apodData, apodLoading, apodError]);

  const handleTranslateApod = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    if (translatedApod) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    try {
      const translateText = async (text) => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=it&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data[0].map(item => item[0]).join('');
      };

      const [translatedTitle, translatedExplanation] = await Promise.all([
        translateText(apodData.title),
        translateText(apodData.explanation)
      ]);

      setTranslatedApod({
        title: translatedTitle,
        explanation: translatedExplanation
      });
      setShowTranslation(true);
    } catch (err) {
      console.error("Errore di traduzione:", err);
      alert("Impossibile connettersi al servizio di traduzione. Riprova più tardi.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') performSearch();
  };

  const clearFilters = () => {
    setQuery('');
    setMediaType('');
    setYearStart('');
    setYearEnd('');
    setSortOrder('newest');
  };

  const handleDownload = async () => {
    if (!selectedItem) return;

    setDownloading(true);
    try {
      const nasa_id = selectedItem.data[0].nasa_id;
      const response = await fetch(`https://images-api.nasa.gov/asset/${nasa_id}`);
      const data = await response.json();

      const items = data.collection.items;
      let originalUrl = null;

      const orig = items.find(item => item.href.includes('~orig'));
      if (orig) {
        originalUrl = orig.href;
      } else if (items.length > 0) {
        originalUrl = items[0].href;
      }

      if (originalUrl) {
        window.open(originalUrl, '_blank');
      } else {
        alert('File originale non trovato per questo asset.');
      }
    } catch (err) {
      console.error("Errore durante il recupero dell'asset:", err);
      alert('Si è verificato un errore durante il download.');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const sortedResults = useMemo(() => {
    if (sortOrder === 'relevance') return results;
    return [...results].sort((a, b) => {
      const dateA = new Date(a.data[0].date_created).getTime();
      const dateB = new Date(b.data[0].date_created).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [results, sortOrder]);

  return (
    <div className="flex h-[100dvh] w-full bg-[#E5E5E5] dark:bg-slate-950 md:p-4 font-sans text-gray-800 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=SN+Pro:wght@400;500;600;700&display=swap');
          .font-sans { font-family: 'SN Pro', sans-serif !important; }`}
      </style>
      <div className="flex flex-col md:flex-row h-full w-full bg-white dark:bg-slate-900 md:rounded-xl md:shadow-2xl overflow-hidden md:border border-gray-200 dark:border-slate-800 relative transition-colors duration-300">

        {/* COLONNA SINISTRA */}
        <div className={`w-full md:w-64 bg-gray-50 dark:bg-slate-900 flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-800 shrink-0 transition-colors duration-300 ${isMobileMenuOpen ? 'absolute inset-0 z-40' : 'relative z-10'}`}>

          {/* Header Compattato */}
          <div className="relative flex items-center justify-center py-5 px-4 bg-slate-950 shrink-0 overflow-hidden text-center md:border-b border-slate-800">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 to-slate-950"></div>
            <div className="absolute inset-0 opacity-[0.15] mix-blend-screen pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden absolute top-3 left-3 p-2 text-slate-300 hover:text-white bg-white/10 rounded-md backdrop-blur-sm transition-colors z-20"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="absolute top-3 right-3 p-2 text-slate-300 hover:text-white bg-white/10 rounded-md backdrop-blur-sm transition-colors z-20"
              title="Cambia Tema"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="flex flex-col items-center relative z-10 w-full mt-1 md:mt-0">
              <img
                src="/logo.png"
                alt="NASA Explorer Logo"
                className="w-16 md:w-20 h-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
              />
            </div>
          </div>

          {/* Menu Navigazione Compattato */}
          <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block px-3 py-2 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0`}>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab('library'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'library' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
              >
                <LayoutGrid className="w-4 h-4" /> Libreria
              </button>
              <button
                onClick={() => { setActiveTab('apod'); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'apod' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
              >
                <Star className="w-4 h-4" /> Foto del Giorno
              </button>
            </div>
          </div>

          {/* Area Scorrevole: Filtri */}
          <div className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900`}>
            {activeTab === 'library' ? (
              <div className="p-4 space-y-5 flex-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ricerca</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 dark:text-white rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Es. Apollo 11"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Filtri Base</label>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-600 dark:text-slate-300">Tipo di Media</span>
                    <div className="relative">
                      <select
                        value={mediaType}
                        onChange={(e) => setMediaType(e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 dark:text-white rounded-md py-1.5 px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Tutti</option>
                        <option value="image">Immagini</option>
                        <option value="video">Video</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-gray-500 dark:text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-gray-600 dark:text-slate-300">Ordinamento</span>
                    <div className="relative">
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 dark:text-white rounded-md py-1.5 px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="newest">Più recenti</option>
                        <option value="oldest">Meno recenti</option>
                        <option value="relevance">Rilevanza (Default)</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-gray-500 dark:text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600 dark:text-slate-300">Anno</span>
                      {(yearStart || yearEnd) && (
                        <button onClick={() => { setYearStart(''); setYearEnd(''); }} className="text-[10px] text-blue-500 hover:underline">Azzera</button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Da"
                        value={yearStart}
                        onChange={(e) => setYearStart(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 dark:text-white rounded-md py-1.5 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-400 dark:text-slate-500">-</span>
                      <input
                        type="number"
                        placeholder="A"
                        value={yearEnd}
                        onChange={(e) => setYearEnd(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 dark:text-white rounded-md py-1.5 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center opacity-50">
                <Star className="w-10 h-10 text-gray-400 dark:text-slate-600 mb-3" />
                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight">I filtri sono disabilitati<br />nella Foto del Giorno.</p>
              </div>
            )}

            {/* Pulsanti Ricerca */}
            {activeTab === 'library' && (
              <div className="p-3 border-t border-gray-200 dark:border-slate-800 shrink-0 bg-gray-50 dark:bg-slate-900">
                <div className="flex gap-2">
                  <button
                    onClick={clearFilters}
                    className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    Pulisci
                  </button>
                  <button
                    onClick={performSearch}
                    className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex justify-center items-center"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cerca'}
                  </button>
                </div>
              </div>
            )}

            {/* Footer Personalizzato Compattato */}
            <div className="mt-auto border-t border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-950 p-4 shrink-0 flex flex-col items-center justify-center gap-3">
              <style>
                {`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap');`}
              </style>
              <div className="flex flex-col items-center gap-1 px-1">
                <span
                  className="text-[11px] text-gray-500 dark:text-slate-400 text-center leading-snug"
                  style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', textShadow: isDarkMode ? '0px 1px 2px rgba(0,0,0,0.5)' : '0px 1px 0px rgba(255, 255, 255, 0.9)' }}
                >
                  "Da qualche parte, qualcosa di incredibile attende di essere scoperto."
                </span>
                <span className="text-[8px] text-gray-400 dark:text-slate-500 uppercase tracking-widest">— Carl Sagan</span>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-3 mt-0.5">
                <a href="https://x.com/antonello23" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gray-400 dark:text-slate-500 hover:text-black dark:hover:text-white transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  <span className="text-[9px] font-medium">@antonello23</span>
                </a>
                <a href="https://instagram.com/antonelloan23" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gray-400 dark:text-slate-500 hover:text-pink-600 dark:hover:text-pink-500 transition-colors">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 21.986 8.741 22 12 22c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                  <span className="text-[9px] font-medium">@antonelloan23</span>
                </a>
                <a href="https://buymeacoffee.com/antonello23" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-gray-400 dark:text-slate-500 hover:text-yellow-600 dark:hover:text-yellow-500 transition-colors">
                  <Coffee className="w-3 h-3" />
                  <span className="text-[9px] font-medium">Buy me a coffee</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* --- VISTA: LIBRERIA --- */}
        {activeTab === 'library' && (
          <>
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-slate-900 md:border-r border-gray-200 dark:border-slate-800 transition-colors duration-300">
              <div className="h-12 border-b border-gray-200 dark:border-slate-800 flex items-center px-4 md:px-6 shrink-0 transition-colors duration-300">
                <h1 className="font-semibold text-base md:text-lg">Ricerca Globale</h1>
                <div className="flex-1"></div>
                <div className="text-xs md:text-sm text-gray-500 dark:text-slate-400">
                  {totalResults.toLocaleString('it-IT')} risultati
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6 bg-gray-50/50 dark:bg-slate-950/50 transition-colors duration-300">
                {loading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : error ? (
                  <div className="text-center text-red-500 mt-10 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="font-medium">Errore durante la ricerca</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-slate-400 mt-20 flex flex-col items-center">
                    <Search className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-4" />
                    <p className="text-lg font-medium">Nessun risultato trovato</p>
                    <p className="text-sm">Prova a modificare i filtri di ricerca</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {sortedResults.map((item, idx) => {
                      const data = item.data[0];
                      const thumb = item.links?.[0]?.href;
                      const isSelected = selectedItem?.data[0]?.nasa_id === data.nasa_id;

                      return (
                        <div
                          key={data.nasa_id + idx}
                          onClick={() => setSelectedItem(item)}
                          className={`flex flex-col bg-white dark:bg-slate-800 border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md ${isSelected ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'border-gray-200 dark:border-slate-700'
                            }`}
                        >
                          <div className="aspect-[4/3] bg-gray-100 dark:bg-slate-900 relative overflow-hidden group">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={data.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-slate-600">
                                Nessuna miniatura
                              </div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-md text-white">
                              {data.media_type === 'video' ? <Video className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                            </div>
                          </div>
                          <div className="p-3 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-1">
                            <h3 className="font-semibold text-sm line-clamp-1" title={data.title}>{data.title}</h3>
                            <div className="flex items-center text-[11px] text-gray-500 dark:text-slate-400 gap-2">
                              <span className="truncate">{formatDate(data.date_created)}</span>
                              {data.center && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600 shrink-0"></span>
                                  <span className="truncate">{data.center}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Pannello Dettagli (Solo se un elemento è selezionato) */}
            {selectedItem ? (
              <div className="fixed inset-0 z-50 md:relative md:w-[360px] bg-white dark:bg-slate-900 flex flex-col shrink-0 animate-in fade-in md:animate-none transition-colors duration-300">
                <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-slate-800 h-14 md:h-12 shrink-0 bg-white dark:bg-slate-900">
                  <h2 className="font-semibold text-base md:text-sm">Dettagli Elemento</h2>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white rounded-md p-2 md:p-1 hover:bg-gray-100 dark:hover:bg-slate-800 bg-gray-100 dark:bg-transparent transition-colors"
                  >
                    <X className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
                  <div className="p-4 pb-0">
                    <div className="w-full bg-black rounded-lg overflow-hidden flex items-center justify-center aspect-video relative">
                      {selectedItem.links?.[0]?.href && (
                        <img
                          src={selectedItem.links[0].href}
                          alt={selectedItem.data[0].title}
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 space-y-6">
                    <div>
                      <h2 className="text-xl md:text-xl font-bold leading-tight mb-4 text-gray-900 dark:text-white">{selectedItem.data[0].title}</h2>

                      <div className="grid grid-cols-2 gap-y-3 text-sm bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
                        <div className="col-span-2">
                          <span className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Data</span>
                          <span className="font-medium text-gray-900 dark:text-slate-200">{formatDate(selectedItem.data[0].date_created)}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Centro Spaziale</span>
                          <span className="font-medium text-gray-900 dark:text-slate-200">{selectedItem.data[0].center || 'N/A'}</span>
                        </div>
                        {selectedItem.data[0].photographer && (
                          <div>
                            <span className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Fotografo</span>
                            <span className="font-medium text-gray-900 dark:text-slate-200">{selectedItem.data[0].photographer}</span>
                          </div>
                        )}
                        {selectedItem.data[0].location && (
                          <div className="col-span-2">
                            <span className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Luogo</span>
                            <span className="font-medium text-gray-900 dark:text-slate-200">{selectedItem.data[0].location}</span>
                          </div>
                        )}
                        <div className="col-span-2 mt-2">
                          <span className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">NASA ID</span>
                          <span className="font-mono text-xs text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-gray-200 dark:border-slate-600 break-all">
                            {selectedItem.data[0].nasa_id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedItem.data[0].description && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Descrizione</h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed text-justify">
                          {selectedItem.data[0].description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="fixed bottom-0 md:relative p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full shrink-0 pb-safe transition-colors duration-300">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full py-3 md:py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    {downloading ? (
                      <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 md:w-4 md:h-4" />
                    )}
                    {downloading ? 'Recupero File...' : 'Scarica Originale'}
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State per il Pannello Dettagli (Visibile solo su Desktop) */
              <div className="hidden md:flex flex-col items-center justify-center w-[360px] bg-gray-50/50 dark:bg-slate-900/50 shrink-0 transition-colors duration-300 text-center px-6">
                <MousePointerClick className="w-12 h-12 text-gray-300 dark:text-slate-700 mb-4" />
                <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Nessun elemento selezionato</p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Clicca su una foto o un video nella griglia per visualizzarne i dettagli e scaricare il formato originale.</p>
              </div>
            )}
          </>
        )}

        {/* --- VISTA: APOD (Foto del Giorno) --- */}
        {activeTab === 'apod' && (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-slate-900 transition-colors duration-300 overflow-y-auto pb-24 md:pb-0">
            <div className="h-12 border-b border-gray-200 dark:border-slate-800 flex items-center px-4 md:px-6 shrink-0 sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
              <h1 className="font-semibold text-base md:text-lg">Astronomy Picture of the Day</h1>
            </div>

            <div className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-8">
              {apodLoading ? (
                <div className="w-full h-64 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : apodError ? (
                <div className="text-center text-red-500 mt-10 p-6 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <p className="font-semibold mb-2">Impossibile caricare l'immagine</p>
                  <p className="text-sm">{apodError}</p>
                </div>
              ) : apodData ? (
                <div className="space-y-6">
                  {/* Media Container */}
                  <div className="w-full bg-black rounded-xl overflow-hidden shadow-lg aspect-video md:aspect-auto flex items-center justify-center">
                    {apodData.media_type === 'video' ? (
                      <iframe
                        src={apodData.url}
                        title={apodData.title}
                        className="w-full aspect-video border-0"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <a href={apodData.hdurl || apodData.url} target="_blank" rel="noreferrer" className="w-full block group relative">
                        <img
                          src={apodData.url}
                          alt={apodData.title}
                          className="w-full h-auto max-h-[70vh] object-contain transition-opacity group-hover:opacity-90"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <span className="bg-black/60 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm text-sm flex items-center gap-2">
                            <ExternalLink className="w-4 h-4" /> Apri Originale
                          </span>
                        </div>
                      </a>
                    )}
                  </div>

                  {/* Informazioni testuali */}
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                          {showTranslation && translatedApod ? translatedApod.title : apodData.title}
                        </h2>
                        <button
                          onClick={handleTranslateApod}
                          disabled={isTranslating}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors shrink-0"
                        >
                          {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                          {showTranslation ? 'Mostra Originale' : 'Traduci in Italiano'}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400 font-medium mt-3">
                        <span>{formatDate(apodData.date)}</span>
                        {apodData.copyright && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600"></span>
                            <span>&copy; {apodData.copyright}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-slate-300 leading-relaxed text-justify">
                        {showTranslation && translatedApod ? translatedApod.explanation : apodData.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}