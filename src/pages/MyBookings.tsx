import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Booking } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Ticket, QrCode, ArrowRight, Info, AlertCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const MyBookings: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      setBookings(bookingsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteBooking = async () => {
    if (!bookingToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'bookings', bookingToDelete));
      toast.success('Booking deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${bookingToDelete}`);
      toast.error('Failed to delete booking');
    } finally {
      setBookingToDelete(null);
      setIsDeleting(false);
    }
  };

  const pastBookings = React.useMemo(() => bookings.filter(b => b.status === 'used' || b.status === 'cancelled'), [bookings]);
  const upcomingBookings = React.useMemo(() => bookings.filter(b => b.status === 'confirmed'), [bookings]);

  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    
    return {
      emptyDays: Array.from({ length: firstDayOfMonth }),
      days: Array.from({ length: daysInMonth }, (_, i) => i + 1)
    };
  }, [currentMonth]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center text-on-surface-variant mb-6">
          <Ticket size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">Sign in to view your tickets</h2>
        <p className="text-on-surface-variant max-w-xs">Your event journey starts here. Sign in to manage your bookings and entry passes.</p>
      </div>
    );
  }

  return (
    <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-8 pb-32">
      <header className="mb-10">
        <h1 className="text-5xl font-extrabold font-headline tracking-tighter text-on-surface mb-2">My Tickets</h1>
        <p className="text-on-surface-variant font-medium">Manage your entries, badges, and local impacts.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-8">
          {/* Upcoming Events */}
          {upcomingBookings.length > 0 ? (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <h3 className="text-2xl font-bold font-headline">Upcoming Events</h3>
                <button 
                  onClick={() => setShowCalendarModal(true)}
                  className="text-primary font-bold text-sm hover:underline"
                >
                  View Calendar
                </button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden group hover:shadow-xl transition-shadow duration-500 border border-outline-variant/10 flex flex-col sm:flex-row relative">
                    {/* Ticket Stub Cutouts */}
                    <div className="hidden sm:block absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-6 bg-background rounded-full border-r border-outline-variant/10 z-10"></div>
                    <div className="hidden sm:block absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 bg-background rounded-full border-l border-outline-variant/10 z-10"></div>
                    
                    <div className="flex-grow p-6 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-dashed border-outline-variant/20">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2 block">
                          {booking.eventDate.toDate().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {booking.eventDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <h4 className="font-headline font-extrabold text-xl line-clamp-2 mb-1">{booking.eventTitle}</h4>
                        <p className="text-sm text-on-surface-variant font-medium">
                          {booking.ticketTypeName || 'Standard'} • {booking.ticketCount} Guest{booking.ticketCount > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="mt-6">
                        <Link to={`/booking/${booking.id}`} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1 w-fit">
                          View Details <ArrowRight size={14} />
                        </Link>
                        <button 
                          onClick={() => setBookingToDelete(booking.id)}
                          className="text-xs font-bold uppercase tracking-widest text-error hover:underline flex items-center gap-1 w-fit mt-2"
                        >
                          Delete Ticket <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6 bg-surface-container-low/30 flex flex-col items-center justify-center shrink-0 sm:w-48 relative">
                      <div className="bg-white p-2.5 rounded-xl shadow-sm border border-outline-variant/10 mb-3 group-hover:scale-105 transition-transform">
                        <QRCodeSVG value={booking.qrCode} size={100} />
                      </div>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest text-center">
                        {booking.id.substring(0, 8)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-xl p-12 text-center border-2 border-dashed border-outline-variant/20">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">confirmation_number</span>
              <h3 className="text-xl font-bold mb-2">No upcoming events</h3>
              <p className="text-on-surface-variant mb-6">You haven't booked any events yet. Start exploring!</p>
              <Link to="/" className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-full font-bold">
                Discover Events <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </section>

        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-surface-container rounded-2xl p-6">
            <h3 className="text-xl font-bold font-headline mb-4">Past Memories</h3>
            <div className="space-y-4">
              {pastBookings.length > 0 ? (
                pastBookings.map(booking => (
                  <div key={booking.id} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-dim overflow-hidden flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined">history</span>
                    </div>
                    <div className="flex-grow">
                      <p className="text-sm font-bold line-clamp-1">{booking.eventTitle}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                        {booking.eventDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "material-symbols-outlined",
                        booking.status === 'used' ? "text-tertiary" : "text-error"
                      )}>
                        {booking.status === 'used' ? 'verified' : 'cancel'}
                      </span>
                      <button 
                        onClick={() => setBookingToDelete(booking.id)}
                        className="p-1.5 rounded-full hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                        title="Delete Memory"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant italic">No past events yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Calendar Modal */}
      <AnimatePresence>
        {showCalendarModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-outline-variant/10 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black tracking-tight">Your Calendar</h2>
                <button 
                  onClick={() => setShowCalendarModal(false)}
                  className="p-2 hover:bg-surface-container rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold font-headline text-lg">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                      className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">chevron_left</span>
                    </button>
                    <button 
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                      className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.emptyDays.map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[80px] p-2 bg-surface-container-lowest/50 rounded-xl"></div>
                  ))}
                  {calendarDays.days.map((day) => {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    const isToday = new Date().toDateString() === date.toDateString();
                    const dayBookings = bookings.filter(b => b.eventDate.toDate().toDateString() === date.toDateString());
                    
                    return (
                      <div 
                        key={day} 
                        className={cn(
                          "min-h-[80px] p-2 flex flex-col gap-1.5 rounded-xl border transition-all overflow-hidden",
                          dayBookings.length > 0 ? "bg-primary/5 border-primary/20" : 
                          isToday ? "bg-surface-container-high border-transparent text-on-surface" : "border-transparent text-on-surface-variant hover:bg-surface-container"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full shrink-0",
                          dayBookings.length > 0 ? "bg-primary text-on-primary" : ""
                        )}>
                          {day}
                        </span>
                        <div className="flex flex-col gap-1 w-full overflow-y-auto no-scrollbar">
                          {dayBookings.map(b => (
                            <div key={b.id} className="text-[10px] leading-tight font-bold bg-primary text-on-primary px-2 py-1 rounded truncate w-full shadow-sm" title={b.eventTitle}>
                              {b.eventTitle}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs text-on-surface-variant font-medium bg-surface-container-low p-4 rounded-xl">
                  <div className="w-3 h-3 rounded-full bg-primary shadow-sm"></div>
                  <span>Event Scheduled</span>
                </div>
              </div>
              <div className="p-6 border-t border-outline-variant/10 bg-surface-container-low/50 flex justify-end shrink-0">
                <button 
                  onClick={() => setShowCalendarModal(false)}
                  className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                >
                  Close Calendar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {bookingToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-2xl max-w-md w-full border border-outline-variant/10"
            >
              <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mb-6 text-error">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold font-headline mb-2">Delete Booking?</h3>
              <p className="text-on-surface-variant mb-8 leading-relaxed">
                Are you sure you want to delete this booking? This action cannot be undone and you will lose access to this ticket.
              </p>
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setBookingToDelete(null)}
                  className="px-6 py-3 rounded-full font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteBooking}
                  className="px-6 py-3 rounded-full font-bold bg-error text-white hover:bg-error/90 transition-colors shadow-lg shadow-error/20 flex items-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  ) : (
                    <Trash2 size={18} />
                  )}
                  Delete Booking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default MyBookings;
