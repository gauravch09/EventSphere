import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, runTransaction, serverTimestamp, collection } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Event, Booking } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketCount, setTicketCount] = useState(1);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('regular');
  const [isBooking, setIsBooking] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); // Update every 10 seconds
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      setAttendeeName(user.displayName || '');
      setAttendeeEmail(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'events', id), (doc) => {
      if (doc.exists()) {
        const eventData = { id: doc.id, ...doc.data() } as Event;
        setEvent(eventData);
        
        // Set default selected ticket to the first enabled one
        const firstEnabled = eventData.ticketTypes?.find(t => t.enabled);
        if (firstEnabled && !eventData.ticketTypes?.find(t => t.id === selectedTicketId)?.enabled) {
          setSelectedTicketId(firstEnabled.id);
        }
      } else {
        toast.error('Event not found');
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${id}`);
    });
    return () => unsubscribe();
  }, [id, navigate, selectedTicketId]);

  const handleBooking = async () => {
    if (!user || !event || !id) {
      toast.error('Please sign in to book tickets');
      return;
    }

    const selectedTicket = (event.ticketTypes || []).find(t => t.id === selectedTicketId);
    if (!selectedTicket || !selectedTicket.enabled) {
      toast.error('Selected ticket type is not available');
      return;
    }

    if (ticketCount > (selectedTicket.available ?? event.availableSeats)) {
      toast.error('Not enough tickets available for this tier');
      return;
    }

    if (!attendeeName || !attendeeEmail) {
      toast.error('Please fill in attendee details');
      return;
    }

    setIsBooking(true);
    try {
      const result = await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, 'events', id);
        let eventDoc;
        try {
          eventDoc = await transaction.get(eventRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `events/${id}`);
          return;
        }
        
        if (!eventDoc.exists()) throw new Error('Event does not exist');
        
        const eventData = eventDoc.data() as Event;
        const ticketTypes = eventData.ticketTypes || [];
        const currentTicketIndex = ticketTypes.findIndex(t => t.id === selectedTicketId);
        const currentTicket = ticketTypes[currentTicketIndex];

        if (!currentTicket || !currentTicket.enabled) throw new Error('Ticket tier is disabled');
        if ((currentTicket.available ?? 0) < ticketCount) throw new Error('Not enough tickets in this tier');

        const bookingRef = doc(collection(db, 'bookings'));
        const bookingData: Omit<Booking, 'id'> = {
          eventId: id,
          userId: user.uid,
          eventTitle: event.title,
          eventDate: event.date,
          ticketCount,
          ticketTypeId: selectedTicket.id,
          ticketTypeName: selectedTicket.name,
          totalPrice,
          attendeeName,
          attendeeEmail,
          status: 'confirmed',
          createdAt: serverTimestamp() as any,
          qrCode: bookingRef.id
        };

        const notificationRef = doc(collection(db, 'notifications'));
        const notificationData = {
          userId: event.organizerId,
          title: 'New Booking!',
          message: `${attendeeName} just booked ${ticketCount} ticket(s) for ${event.title}.`,
          read: false,
          createdAt: serverTimestamp(),
          type: 'booking'
        };

        // Update ticket types array with new availability
        const updatedTicketTypes = [...ticketTypes];
        updatedTicketTypes[currentTicketIndex] = {
          ...currentTicket,
          available: (currentTicket.available ?? 0) - ticketCount
        };

        transaction.set(bookingRef, bookingData);
        transaction.set(notificationRef, notificationData);
        transaction.update(eventRef, {
          availableSeats: (eventData.availableSeats || 0) - ticketCount,
          soldCount: (eventData.soldCount || 0) + ticketCount,
          ticketTypes: updatedTicketTypes
        });

        // Return booking data for email
        return {
          bookingId: bookingRef.id,
          attendeeEmail,
          attendeeName,
          eventTitle: event.title,
          eventDate: event.date.toDate().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' at ' + event.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          ticketTypeName: selectedTicket.name,
          ticketCount,
          totalPrice
        };
      });

      // Send confirmation email via backend
      try {
        await fetch('/api/send-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Don't fail the whole booking if email fails, but log it
      }

      toast.success('Tickets booked successfully!');
      setShowSuccessAnimation(true);
      setTimeout(() => {
        navigate('/my-bookings');
      }, 3000);
    } catch (error) {
      console.error('Booking error:', error);
      if (error instanceof Error && error.message.includes('Firestore Error')) {
        // Already handled and logged
      } else {
        toast.error('Failed to book tickets. Please try again.');
      }
      setIsBooking(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!event) return null;

  const selectedTicket = event.ticketTypes?.find(t => t.id === selectedTicketId) || event.ticketTypes?.[0] || { price: 0, name: 'Standard', id: 'regular' };
  const totalPrice = (selectedTicket.price || 0) * ticketCount;

  let timeRemaining = null;
  let isBookingClosed = false;
  let showTimer = false;

  if (event.bookingCloseTime) {
    const closeTime = event.bookingCloseTime.toDate().getTime();
    timeRemaining = closeTime - currentTime.getTime();
    isBookingClosed = timeRemaining <= 0;
    showTimer = timeRemaining > 0 && timeRemaining <= 20 * 60 * 1000; // 20 minutes
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Media & Core Info */}
        <div className="lg:col-span-7 space-y-8">
          {/* Hero Poster Section */}
          <section className="overflow-hidden rounded-2xl bg-surface-container-high shadow-lg">
            <img 
              src={event.imageUrl} 
              alt={event.title}
              className="w-full h-[300px] md:h-[400px] object-cover"
            />
          </section>

          <div>
            <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter mb-6 text-on-surface">{event.title}</h1>
            <div className="flex flex-col gap-4 text-on-surface-variant font-medium mb-8">
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">calendar_today</span>
                {event.date.toDate().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {event.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">location_on</span>
                {event.venue}, {event.city}
              </span>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/10">
              <h3 className="font-headline text-xl font-bold mb-4">About the Event</h3>
              <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Booking */}
        <div className="lg:col-span-5">
          <div className="sticky top-28 bg-surface-container-lowest rounded-2xl p-8 shadow-xl border border-outline-variant/10">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-headline text-2xl font-black tracking-tight">Select Tickets</h2>
              </div>
              <p className="text-sm text-on-surface-variant mb-4">
                {event.availableSeats} seats remaining
              </p>
              
              {showTimer && !isBookingClosed && (
                <div className="bg-error/10 border border-error/20 p-4 rounded-xl flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-error">
                    <span className="material-symbols-outlined animate-pulse">timer</span>
                    <span className="text-sm font-bold">Bookings close in:</span>
                  </div>
                  <span className="text-xl font-mono font-black text-error">{formatTime(timeRemaining!)}</span>
                </div>
              )}

              {isBookingClosed && (
                <div className="bg-surface-container-high border border-outline-variant/20 p-4 rounded-xl flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-on-surface-variant">event_busy</span>
                  <span className="text-sm font-bold text-on-surface">Bookings are now closed for this event.</span>
                </div>
              )}
            </div>

            <div className="space-y-6 mb-8">
              {/* Ticket Types Selection */}
              <div className="space-y-3">
                {event.ticketTypes?.filter(t => t.enabled).map((ticket) => (
                  <button
                    key={ticket.id}
                    disabled={isBookingClosed || (ticket.available ?? 0) === 0}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={cn(
                      "w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left group",
                      selectedTicketId === ticket.id 
                        ? "border-primary bg-primary/5 shadow-md" 
                        : "border-outline-variant/10 bg-surface-container-low hover:border-outline-variant/30",
                      (ticket.available ?? 0) === 0 && "opacity-50 grayscale cursor-not-allowed"
                    )}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{ticket.name}</span>
                        {ticket.type === 'early' && <span className="bg-primary text-on-primary text-[8px] px-1.5 py-0.5 rounded font-black uppercase">SAVE</span>}
                        {ticket.type === 'vip' && <span className="bg-tertiary text-on-tertiary text-[8px] px-1.5 py-0.5 rounded font-black uppercase">PREMIUM</span>}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="text-[10px] text-on-surface-variant font-medium">{ticket.description}</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          (ticket.available ?? 0) < 5 ? "text-error" : "text-primary"
                        )}>
                          {(ticket.available ?? 0) === 0 ? 'Sold Out' : `${ticket.available} left`}
                        </span>
                      </div>
                    </div>
                    <span className="font-headline font-black text-xl">
                      {ticket.price === 0 ? 'Free' : `₹${ticket.price}`}
                    </span>
                  </button>
                ))}
              </div>

              {/* Attendee Info */}
              <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Full Name</label>
                  <input 
                    type="text" 
                    value={attendeeName}
                    onChange={(e) => setAttendeeName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/20 focus:ring-2 focus:ring-primary outline-none text-sm font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Email Address</label>
                  <input 
                    type="email" 
                    value={attendeeEmail}
                    onChange={(e) => setAttendeeEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/20 focus:ring-2 focus:ring-primary outline-none text-sm font-medium transition-all"
                  />
                </div>
              </div>

              {/* Ticket Counter */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 bg-surface-container-low/50">
                <span className="font-bold">Quantity</span>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                    className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold hover:bg-surface-container-high transition-colors text-xl"
                  >-</button>
                  <span className="font-bold w-6 text-center text-lg">{ticketCount}</span>
                  <button 
                    onClick={() => setTicketCount(Math.min(10, ticketCount + 1))}
                    className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold hover:bg-surface-container-high transition-colors text-xl"
                  >+</button>
                </div>
              </div>

              {/* Total Price */}
              <div className="pt-4 border-t border-outline-variant/10">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface-variant">Total</span>
                  <span className="font-headline text-3xl font-black text-primary">
                    {totalPrice === 0 ? 'Free' : `₹${totalPrice.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Book Button */}
            <button 
              onClick={handleBooking}
              disabled={isBooking || event.availableSeats === 0 || isBookingClosed}
              className="w-full bg-primary text-on-primary py-5 rounded-2xl font-black text-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
            >
              {isBooking ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span> Processing...</>
              ) : isBookingClosed ? (
                'Bookings Closed'
              ) : event.availableSeats === 0 ? (
                'Sold Out'
              ) : (
                <>
                  <span>Book Now</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Secure checkout • Digital QR ticket</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="bg-surface-container-lowest p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center max-w-sm w-full border border-primary/20 text-center"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
                className="w-24 h-24 bg-primary-container rounded-full flex items-center justify-center mb-6"
              >
                <span className="material-symbols-outlined text-5xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </motion.div>
              <h2 className="text-3xl font-black font-headline tracking-tighter mb-2">Confirmed!</h2>
              <p className="text-on-surface-variant font-medium mb-8">Your tickets are secured.</p>
              
              <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.5, ease: "linear" }}
                  className="h-full bg-primary"
                />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-4 animate-pulse">
                Redirecting to your tickets...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default EventDetails;
