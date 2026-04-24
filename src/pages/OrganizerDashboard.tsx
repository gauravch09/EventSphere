import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Event, Booking } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Calendar, TrendingUp, Trash2, Edit, QrCode, AlertCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const OrganizerDashboard: React.FC = () => {
  const { user, profile, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<Event | null>(null);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      navigate('/');
      return;
    }
    
    // Redirect if not an organizer
    const isOrganizer = profile?.email === 'gy426408@gmail.com' || profile?.role === 'admin';
    if (!isOrganizer) {
      navigate('/');
      toast.error('Access denied. Organizer privileges required.');
      return;
    }

    const eventsQuery = query(collection(db, 'events'), where('organizerId', '==', user.uid));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    const bookingsQuery = query(collection(db, 'bookings'));
    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      setBookings(bookingsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => {
      unsubscribeEvents();
      unsubscribeBookings();
    };
  }, [user]);

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await deleteDoc(doc(db, 'events', eventToDelete));
      toast.success('Event deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${eventToDelete}`);
      toast.error('Failed to delete event');
    } finally {
      setEventToDelete(null);
    }
  };

  const stats = React.useMemo(() => ({
    totalEvents: events.length,
    totalTicketsSold: bookings.filter(b => events.some(e => e.id === b.eventId)).reduce((acc, b) => acc + b.ticketCount, 0),
    totalRevenue: bookings.filter(b => events.some(e => e.id === b.eventId)).reduce((acc, b) => acc + b.totalPrice, 0),
    uniqueAttendees: new Set(bookings.filter(b => events.some(e => e.id === b.eventId)).map(b => b.userId)).size
  }), [events, bookings]);

  const featuredEvent = events[0];
  const featuredEventBookings = React.useMemo(() => featuredEvent ? bookings.filter(b => b.eventId === featuredEvent.id) : [], [featuredEvent, bookings]);
  const capacityPercentage = React.useMemo(() => featuredEvent ? Math.round(((featuredEvent.totalSeats - featuredEvent.availableSeats) / featuredEvent.totalSeats) * 100) : 0, [featuredEvent]);

  if (!user) return <div className="p-8 text-center">Please sign in to access the dashboard.</div>;

  return (
    <main className="flex-grow max-w-7xl mx-auto w-full px-8 py-12 pb-32">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tighter text-on-surface mb-2">Organizer Dashboard</h1>
          <p className="text-on-surface-variant font-medium">Managing {events.length} active events across the metro area.</p>
        </div>
        <div className="flex gap-4">
          <Link 
            to="/scanner"
            className="bg-surface-container text-on-surface px-8 py-4 rounded-full font-bold flex items-center gap-3 shadow-md hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Open Scanner
          </Link>
          <Link 
            to="/create-event"
            className="bg-primary text-on-primary px-8 py-4 rounded-full font-bold flex items-center gap-3 shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Create New Event
          </Link>
        </div>
      </header>

      {/* High-Level Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined">event</span>
          </div>
          <p className="text-4xl font-black mb-1">{stats.totalEvents}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Events</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary mb-4">
            <span className="material-symbols-outlined">confirmation_number</span>
          </div>
          <p className="text-4xl font-black mb-1">{stats.totalTicketsSold}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Tickets Sold</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-tertiary/10 rounded-full flex items-center justify-center text-tertiary mb-4">
            <span className="material-symbols-outlined">group</span>
          </div>
          <p className="text-4xl font-black mb-1">{stats.uniqueAttendees}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Unique Attendees</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <span className="material-symbols-outlined">payments</span>
          </div>
          <p className="text-4xl font-black mb-1">₹{stats.totalRevenue.toFixed(2)}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Revenue</p>
        </div>
      </div>

      {/* Event List */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-3xl font-extrabold tracking-tight font-headline">Your Events</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {events.map((event) => {
            const eventBookings = bookings.filter(b => b.eventId === event.id);
            const ticketsSold = eventBookings.reduce((acc, b) => acc + b.ticketCount, 0);
            const revenue = eventBookings.reduce((acc, b) => acc + b.totalPrice, 0);
            const capacityPercentage = Math.round((ticketsSold / event.totalSeats) * 100) || 0;
            
            const closeTime = event.bookingCloseTime?.toDate().getTime();
            const timeRemaining = closeTime ? closeTime - currentTime.getTime() : null;
            const showTimer = timeRemaining !== null && timeRemaining > 0 && timeRemaining <= 20 * 60 * 1000;
            const isClosed = closeTime ? closeTime < currentTime.getTime() : false;

            const formatTime = (ms: number) => {
              const totalSeconds = Math.floor(ms / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            };

            return (
              <div key={event.id} className={cn(
                "bg-surface-container-lowest p-6 rounded-[1.5rem] flex flex-col lg:flex-row lg:items-center gap-8 shadow-sm group border border-outline-variant/10 hover:shadow-md transition-shadow relative",
                showTimer && "ring-2 ring-error ring-offset-2"
              )}>
                <div className="w-full lg:w-48 h-32 rounded-xl overflow-hidden shrink-0 relative">
                  <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 left-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                    {event.category}
                  </div>
                  {showTimer && (
                    <div className="absolute inset-0 bg-error/20 flex items-center justify-center">
                      <div className="bg-error text-on-error text-[10px] font-black px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">timer</span>
                        {formatTime(timeRemaining!)}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-primary">calendar_month</span>
                      <span className="text-sm font-bold text-on-surface-variant">
                        {event.date.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    {showTimer && (
                      <span className="bg-error/10 text-error text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">
                        Closing Soon
                      </span>
                    )}
                    {isClosed && (
                      <span className="bg-surface-container-high text-on-surface-variant text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                        Closed
                      </span>
                    )}
                  </div>
                  <h4 className="text-2xl font-bold font-headline mb-1">{event.title}</h4>
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {event.venue}
                  </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap items-center gap-8 lg:px-8 lg:border-l border-outline-variant/15 w-full lg:w-auto">
                  <div className="flex-1 lg:flex-none">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-bold">{ticketsSold} / {event.totalSeats}</span>
                      <span className="text-on-surface-variant">Sold</span>
                    </div>
                    <div className="h-2 w-full lg:w-32 bg-surface-container rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="text-left lg:text-center flex-1 lg:flex-none">
                    <p className="text-2xl font-black">₹{revenue.toFixed(2)}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Revenue</p>
                  </div>
                </div>

                <div className="flex gap-3 w-full lg:w-auto justify-end border-t lg:border-t-0 border-outline-variant/10 pt-4 lg:pt-0">
                  <button 
                    onClick={() => {
                      setSelectedEventForAttendees(event);
                      setShowAttendeeModal(true);
                    }}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-surface-container hover:bg-secondary hover:text-white px-4 py-3 rounded-xl font-bold transition-colors"
                    title="View Attendees"
                  >
                    <span className="material-symbols-outlined">groups</span>
                    <span className="lg:hidden">Attendees</span>
                  </button>
                  <button 
                    onClick={() => navigate(`/edit-event/${event.id}`)}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-surface-container hover:bg-primary hover:text-white px-4 py-3 rounded-xl font-bold transition-colors"
                  >
                    <span className="material-symbols-outlined">edit</span>
                    <span className="lg:hidden">Edit</span>
                  </button>
                  <button 
                    onClick={() => setEventToDelete(event.id)}
                    className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-error/10 text-error hover:bg-error hover:text-white px-4 py-3 rounded-xl font-bold transition-colors"
                  >
                    <span className="material-symbols-outlined">delete</span>
                    <span className="lg:hidden">Delete</span>
                  </button>
                </div>
              </div>
            );
          })}

          {events.length === 0 && !loading && (
            <div className="text-center py-24 bg-surface-container-lowest border border-dashed border-outline-variant/20 rounded-3xl">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">event_busy</span>
              <h3 className="text-2xl font-bold mb-2">No Events Yet</h3>
              <p className="text-on-surface-variant font-medium mb-6">You haven't created any events yet. Start hosting today!</p>
              <Link to="/create-event" className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">
                Create your first event <Plus size={18} />
              </Link>
            </div>
          )}
        </div>
      </div>
      {/* Attendee Modal */}
      <AnimatePresence>
        {showAttendeeModal && selectedEventForAttendees && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Attendee List</h2>
                  <p className="text-sm text-on-surface-variant">{selectedEventForAttendees.title}</p>
                </div>
                <button 
                  onClick={() => setShowAttendeeModal(false)}
                  className="p-2 hover:bg-surface-container rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  {bookings.filter(b => b.eventId === selectedEventForAttendees.id).length > 0 ? (
                    bookings.filter(b => b.eventId === selectedEventForAttendees.id).map((booking, idx) => (
                      <div key={booking.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-lg">{booking.attendeeName || 'Unknown Attendee'}</p>
                            <p className="text-sm text-on-surface-variant mb-1">{booking.attendeeEmail || 'No email provided'}</p>
                            <p className="text-xs text-on-surface-variant">
                              Ticket ID: {booking.id.substring(0, 8)}... • Status: <span className={cn("font-bold uppercase", booking.status === 'used' ? 'text-tertiary' : 'text-primary')}>{booking.status}</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{booking.ticketTypeName || 'Standard'}</p>
                          <p className="text-sm font-medium text-on-surface-variant">{booking.ticketCount} Tickets</p>
                          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                            {booking.createdAt?.toDate().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">person_off</span>
                      <p className="text-on-surface-variant">No attendees have joined yet.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-8 bg-surface-container-low flex justify-end">
                <button 
                  onClick={() => setShowAttendeeModal(false)}
                  className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold shadow-lg"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {eventToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-2xl max-w-md w-full border border-outline-variant/10"
            >
              <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mb-6 text-error">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <h3 className="text-2xl font-bold font-headline mb-2">Delete Event?</h3>
              <p className="text-on-surface-variant mb-8 leading-relaxed">
                This action cannot be undone. All bookings associated with this event will be orphaned. Are you sure you want to proceed?
              </p>
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setEventToDelete(null)}
                  className="px-6 py-3 rounded-full font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteEvent}
                  className="px-6 py-3 rounded-full font-bold bg-error text-white hover:bg-error/90 transition-colors shadow-lg shadow-error/20"
                >
                  Delete Event
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default OrganizerDashboard;
