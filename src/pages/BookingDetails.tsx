import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Booking } from '../types';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { Ticket, Calendar, User, Mail, CheckCircle, ArrowLeft, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';

const BookingDetails: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const isOrganizer = profile?.email === 'gy426408@gmail.com' || profile?.role === 'admin';

  useEffect(() => {
    if (!bookingId) return;

    const unsubscribe = onSnapshot(doc(db, 'bookings', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        setBooking({ id: docSnap.id, ...docSnap.data() } as Booking);
      } else {
        setBooking(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `bookings/${bookingId}`);
    });

    return () => unsubscribe();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full"></div>
          <p className="text-on-surface-variant font-bold">Fetching Booking Info...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-6xl text-error mb-4">error</span>
        <h2 className="text-2xl font-black mb-2">Booking Not Found</h2>
        <p className="text-on-surface-variant mb-8">The ticket ID provided does not exist in our records.</p>
        <button 
          onClick={() => navigate('/scanner')}
          className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold"
        >
          Back to Scanner
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-surface-container-low pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-12">
        <button 
          onClick={() => navigate(isOrganizer ? '/scanner' : '/my-bookings')}
          className="flex items-center gap-2 text-on-surface-variant font-bold mb-8 hover:text-primary transition-colors"
        >
          <ArrowLeft size={20} />
          Back to {isOrganizer ? 'Scanner' : 'My Tickets'}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest rounded-[2.5rem] shadow-2xl overflow-hidden border border-outline-variant/10"
        >
          {/* Status Header */}
          <div className={`p-8 text-center ${booking.status === 'used' ? 'bg-tertiary text-on-tertiary' : 'bg-primary text-on-primary'}`}>
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <CheckCircle size={40} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              {booking.status === 'used' ? 'Ticket Validated' : 'Valid Entry Pass'}
            </h1>
            <p className="opacity-80 font-bold text-sm tracking-widest mt-1">
              ID: {booking.id.toUpperCase()}
            </p>
          </div>

          <div className="p-8 md:p-12 space-y-10">
            {/* Event Info */}
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-6 flex items-center gap-2">
                <Ticket size={14} /> Event Details
              </h3>
              <div className="space-y-4">
                <h2 className="text-4xl font-black tracking-tight leading-none">{booking.eventTitle}</h2>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-3 text-on-surface-variant font-bold">
                    <Calendar size={20} className="text-primary" />
                    <span>
                      {booking.eventDate.toDate().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-on-surface-variant font-bold">
                    <span className="material-symbols-outlined text-primary">schedule</span>
                    <span>{booking.eventDate.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-outline-variant/10" />

            {/* Attendee Info */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 flex items-center gap-2">
                  <User size={14} /> Attendee
                </h3>
                <p className="text-xl font-bold">{booking.attendeeName}</p>
                <div className="flex items-center gap-2 text-on-surface-variant mt-1">
                  <Mail size={14} />
                  <span className="text-sm font-medium">{booking.attendeeEmail}</span>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">confirmation_number</span> Ticket Type
                </h3>
                <p className="text-xl font-bold">{booking.ticketTypeName || 'Standard'}</p>
                <p className="text-xs text-on-surface-variant font-medium mt-1">{booking.ticketCount} Guest{booking.ticketCount > 1 ? 's' : ''}</p>
              </div>
            </section>

            <hr className="border-outline-variant/10" />

            {/* Booking Metadata */}
            <section className="bg-surface-container-low p-6 rounded-2xl flex flex-wrap justify-between items-center gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Booked On</p>
                <p className="font-bold">{booking.createdAt?.toDate().toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Total Paid</p>
                <p className="font-bold text-primary">₹{booking.totalPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Status</p>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  booking.status === 'used' ? "bg-tertiary/10 text-tertiary" : "bg-primary/10 text-primary"
                )}>
                  {booking.status}
                </span>
              </div>
            </section>

            {/* QR Code Section */}
            {booking.status !== 'cancelled' && (
              <section className="flex flex-col items-center justify-center pt-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-outline-variant/10 mb-4">
                  <QRCodeSVG value={booking.qrCode} size={200} />
                </div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-on-surface-variant">
                  {booking.id.toUpperCase()}
                </p>
                <p className="text-xs text-on-surface-variant mt-2 font-medium">
                  Scan this code at the venue for entry
                </p>
              </section>
            )}

            {isOrganizer && booking.status !== 'used' && (
              <div className="pt-4">
                <p className="text-center text-xs text-on-surface-variant font-medium mb-4 italic">
                  Verify the attendee's ID matches the name above before entry.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default BookingDetails;
