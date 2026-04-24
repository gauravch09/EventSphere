import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Calendar, ArrowRight, Star, Verified } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { logSearch } from '../services/searchTrendService';
import { INDIAN_CITIES } from '../constants';

const EventCard = React.memo<{ event: Event; currentTime: Date }>(({ event, currentTime }) => {
  let timeRemaining = null;
  let showTimer = false;

  if (event.bookingCloseTime) {
    const closeTime = event.bookingCloseTime.toDate().getTime();
    timeRemaining = closeTime - currentTime.getTime();
    showTimer = timeRemaining > 0 && timeRemaining <= 20 * 60 * 1000;
  }

  const isClosed = event.bookingCloseTime && event.bookingCloseTime.toDate().getTime() < currentTime.getTime();

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Link 
      to={isClosed ? '#' : `/event/${event.id}`}
      className={cn(
        "bg-surface-container-lowest rounded-xl p-4 shadow-sm group hover:shadow-lg transition-all duration-300 flex flex-col h-full relative",
        isClosed && "opacity-75 grayscale-[0.5] cursor-default",
        showTimer && !isClosed && "ring-2 ring-error ring-offset-2"
      )}
      onClick={(e) => isClosed && e.preventDefault()}
    >
      <div className="relative overflow-hidden rounded-lg h-48 mb-4">
        <img 
          src={event.imageUrl} 
          alt={event.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {showTimer && (
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
            <div className="bg-error text-on-error text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-2 shadow-xl animate-pulse border border-white/20">
              <span className="material-symbols-outlined text-[16px]">timer</span> 
              <span>{formatTime(timeRemaining!)}</span>
            </div>
            <div className="bg-error/90 backdrop-blur-md text-on-error text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-lg border border-white/10">
              Closing Soon!
            </div>
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
          {event.category}
        </div>
      </div>
      <div className="flex justify-between items-start mb-2 gap-2">
        <h4 className="font-headline font-black text-lg leading-tight line-clamp-2">{event.title}</h4>
        <span className="text-primary font-black text-base shrink-0">
          {event.ticketTypes?.[0]?.price === 0 ? 'Free' : `₹${event.ticketTypes?.[0]?.price || 0}`}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-on-surface-variant text-xs mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">calendar_month</span> 
          <span className="font-medium">{event.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-primary">location_on</span> 
          <span className="font-medium line-clamp-1">{event.venue}, {event.city}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-outline-variant/10">
        <div className="flex flex-col">
          <span className={cn(
            "text-xs font-black",
            event.availableSeats < 10 ? "text-error" : "text-primary"
          )}>
            {event.availableSeats === 0 ? 'Sold Out' : `${event.availableSeats} seats left`}
          </span>
          <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
            {event.soldCount || 0} attending
          </span>
        </div>
        <div className={cn(
          "px-5 py-2 rounded-full text-xs font-black transition-all",
          isClosed 
            ? "bg-surface-container-highest text-on-surface-variant" 
            : "bg-primary text-on-primary shadow-md group-hover:shadow-lg group-hover:scale-105"
        )}>
          {isClosed ? 'Closed' : 'View Details'}
        </div>
      </div>
    </Link>
  );
});
const Home: React.FC = () => {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCity, setSelectedCity] = useState('');
  const [showCityPrompt, setShowCityPrompt] = useState(false);
  const [promptCityInput, setPromptCityInput] = useState('');
  const eventsGridRef = React.useRef<HTMLDivElement>(null);

  // Debounced search logging
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 3) return;
    
    const timer = setTimeout(() => {
      logSearch(searchTerm);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const categories = [
    { name: 'All', icon: 'apps' },
    { name: 'Music', icon: 'festival' },
    { name: 'Tech', icon: 'devices' },
    { name: 'Sports', icon: 'sports_soccer' },
    { name: 'Workshop', icon: 'architecture' },
    { name: 'Arts', icon: 'palette' }
  ];

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile) {
      if (profile.city) {
        setSelectedCity(profile.city);
      } else {
        setShowCityPrompt(true);
      }
    }
  }, [profile]);

  const handleSaveCity = async () => {
    if (!user || !promptCityInput.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { city: promptCityInput.trim() });
      setSelectedCity(promptCityInput.trim());
      setShowCityPrompt(false);
      toast.success('City saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAllEvents, setShowAllEvents] = useState(false);
  const INITIAL_DISPLAY_LIMIT = 6;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Update every 10 seconds to reduce re-renders
    return () => clearInterval(timer);
  }, []);

  const filteredEvents = React.useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           event.venue.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
      const matchesCity = !selectedCity || (event.city && event.city.toLowerCase() === selectedCity.toLowerCase());
      return matchesSearch && matchesCategory && matchesCity;
    });
  }, [events, searchTerm, selectedCategory, selectedCity]);

  const closingSoonEvents = React.useMemo(() => {
    return filteredEvents.filter(event => {
      if (!event.bookingCloseTime) return false;
      const closeTime = event.bookingCloseTime.toDate().getTime();
      const now = currentTime.getTime();
      const diff = closeTime - now;
      return diff > 0 && diff <= 20 * 60 * 1000;
    });
  }, [filteredEvents, currentTime]);

  const otherEvents = React.useMemo(() => {
    return filteredEvents.filter(event => !closingSoonEvents.some(ce => ce.id === event.id));
  }, [filteredEvents, closingSoonEvents]);

  const displayedOtherEvents = React.useMemo(() => {
    return showAllEvents ? otherEvents : otherEvents.slice(0, INITIAL_DISPLAY_LIMIT);
  }, [otherEvents, showAllEvents]);

  return (
    <div className="max-w-7xl mx-auto w-full px-8 pt-8 pb-24 md:pb-12">
      {/* Hero Search & Categories */}
      <section className="mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-headline text-5xl md:text-6xl font-extrabold tracking-tight mb-8 leading-[1.1]"
        >
          The Kinetic <span className="text-primary italic">Pulse</span> <br/>of your City.
        </motion.h1>
        
        <div className="flex overflow-x-auto pb-4 md:pb-0 md:flex-wrap gap-3 mb-10 no-scrollbar -mx-8 px-8 md:mx-0 md:px-0">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={cn(
                "px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all duration-300 whitespace-nowrap",
                selectedCategory === cat.name
                  ? "bg-primary text-on-primary shadow-lg scale-105"
                  : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
              )}
            >
              <span className="material-symbols-outlined">{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 max-w-3xl mb-12">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-on-surface-variant">search</span>
            </div>
            <input
              type="text"
              placeholder="Search nearby events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-low px-12 py-4 rounded-full border border-outline-variant/15 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium transition-all"
            />
          </div>
          <div className="relative md:w-64">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-on-surface-variant">location_city</span>
            </div>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-surface-container-low pl-12 pr-6 py-4 rounded-full border border-outline-variant/15 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-medium transition-all appearance-none"
            >
              <option value="">All Cities</option>
              {INDIAN_CITIES.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="w-full">
        {/* Closing Soon Section */}
        {closingSoonEvents.length > 0 && (
          <section className="mb-12">
            <h2 className="font-headline text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-error">timer</span> Closing Soon
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {closingSoonEvents.map((event) => (
                <EventCard key={`${event.id}-${event.bookingCloseTime?.toMillis()}-${event.availableSeats}`} event={event} currentTime={currentTime} />
              ))}
            </div>
          </section>
        )}

        {/* All Events Section */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-2xl font-bold">All Events</h2>
          </div>

          <div ref={eventsGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedOtherEvents.map((event) => (
              <EventCard key={`${event.id}-${event.bookingCloseTime?.toMillis()}`} event={event} currentTime={currentTime} />
            ))}
          </div>

          {otherEvents.length > INITIAL_DISPLAY_LIMIT && !showAllEvents && (
            <div className="flex justify-center pt-8">
              <button 
                onClick={() => setShowAllEvents(true)}
                className="group flex items-center gap-2 px-8 py-4 bg-surface-container-high hover:bg-primary hover:text-on-primary rounded-full font-bold transition-all duration-300 shadow-sm hover:shadow-lg"
              >
                View All Events
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {filteredEvents.length === 0 && !loading && (
            <div className="text-center py-20 bg-surface-container-low rounded-2xl">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">event_busy</span>
              <p className="text-on-surface-variant font-medium">No events found matching your criteria.</p>
            </div>
          )}
        </section>
      </div>

      {/* City Prompt Modal */}
      <AnimatePresence>
        {showCityPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-outline-variant/10 p-8"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl">location_city</span>
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-2">Where are you?</h2>
                <p className="text-on-surface-variant text-sm">Enter your city to discover events happening near you.</p>
              </div>
              <div className="space-y-4">
                <select
                  value={promptCityInput}
                  onChange={(e) => setPromptCityInput(e.target.value)}
                  className="w-full bg-surface-container-low px-6 py-4 rounded-xl border border-outline-variant/20 focus:ring-2 focus:ring-primary outline-none font-medium transition-all appearance-none"
                >
                  <option value="">Select your city</option>
                  {INDIAN_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCityPrompt(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Skip
                  </button>
                  <button 
                    onClick={handleSaveCity}
                    disabled={!promptCityInput.trim()}
                    className="flex-1 bg-primary text-on-primary py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save City
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;