import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { INDIAN_CITIES, CITY_COLLEGES } from '../constants';
import { cn } from '../lib/utils';

export default function CreateEvent() {
  const { user, profile, isAuthReady } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    bookingCloseDate: '',
    bookingCloseTime: '',
    venue: '',
    city: '',
    category: 'Music',
    totalSeats: 100,
    ticketTypes: [
      { id: 'early', name: 'Early Bird', description: 'Limited availability', price: 199, type: 'early', enabled: true, capacity: 20 },
      { id: 'regular', name: 'Regular', description: 'Standard entry', price: 299, type: 'regular', enabled: true, capacity: 50 },
      { id: 'vip', name: 'VIP', description: 'Priority entry + perks', price: 999, type: 'vip', enabled: false, capacity: 10 },
      { id: 'group', name: 'Group (4+)', description: 'Discounted per person', price: 249, type: 'group', enabled: false, capacity: 20 }
    ],
    imageUrl: ''
  });

  const categories = ['Music', 'Tech', 'Sports', 'Workshop', 'Arts'];

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

    if (eventId) {
      const loadEvent = async () => {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          const data = eventDoc.data();
          const date = data.date.toDate();
          const closeDate = data.bookingCloseTime ? data.bookingCloseTime.toDate() : null;
          setFormData({
            title: data.title,
            description: data.description,
            date: date.toISOString().split('T')[0],
            time: date.toTimeString().split(' ')[0].substring(0, 5),
            bookingCloseDate: closeDate ? closeDate.toISOString().split('T')[0] : '',
            bookingCloseTime: closeDate ? closeDate.toTimeString().split(' ')[0].substring(0, 5) : '',
            venue: data.venue,
            city: data.city || '',
            category: data.category,
            totalSeats: data.totalSeats,
            ticketTypes: data.ticketTypes || [
              { id: 'early', name: 'Early Bird', description: 'Limited availability', price: 199, type: 'early', enabled: true, capacity: 20 },
              { id: 'regular', name: 'Regular', description: 'Standard entry', price: 299, type: 'regular', enabled: true, capacity: 50 },
              { id: 'vip', name: 'VIP', description: 'Priority entry + perks', price: 999, type: 'vip', enabled: false, capacity: 10 },
              { id: 'group', name: 'Group (4+)', description: 'Discounted per person', price: 249, type: 'group', enabled: false, capacity: 20 }
            ],
            imageUrl: data.imageUrl
          });
        }
      };
      loadEvent();
    }
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const eventDate = new Date(`${formData.date}T${formData.time}`);
      const closeDate = formData.bookingCloseDate && formData.bookingCloseTime 
        ? new Date(`${formData.bookingCloseDate}T${formData.bookingCloseTime}`) 
        : null;
        
      const totalSeats = formData.ticketTypes
        .filter(t => t.enabled)
        .reduce((acc, t) => acc + Number(t.capacity), 0);

      const ticketTypesWithAvailable = formData.ticketTypes.map(t => ({
        ...t,
        available: t.enabled ? Number(t.capacity) : 0
      }));

      const eventData: any = {
        title: formData.title,
        description: formData.description,
        date: Timestamp.fromDate(eventDate),
        venue: formData.venue,
        city: formData.city,
        category: formData.category,
        totalSeats: totalSeats,
        ticketTypes: ticketTypesWithAvailable,
        imageUrl: formData.imageUrl || `https://picsum.photos/seed/${formData.title}/800/600`,
        organizerId: user.uid,
        organizerName: user.displayName || 'Anonymous',
      };
      
      if (closeDate) {
        eventData.bookingCloseTime = Timestamp.fromDate(closeDate);
      }

      if (eventId) {
        try {
          const eventRef = doc(db, 'events', eventId);
          const eventSnap = await getDoc(eventRef);
          if (eventSnap.exists()) {
            const oldData = eventSnap.data();
            const seatDiff = totalSeats - oldData.totalSeats;
            eventData.availableSeats = Math.max(0, oldData.availableSeats + seatDiff);
            eventData.soldCount = oldData.soldCount || 0;
            
            // For existing events, we need to handle ticket availability carefully
            // For simplicity in this update, we'll just reset them if they weren't there
            eventData.ticketTypes = ticketTypesWithAvailable.map(t => {
              const oldTicket = oldData.ticketTypes?.find((ot: any) => ot.id === t.id);
              if (oldTicket) {
                const capDiff = Number(t.capacity) - (oldTicket.capacity || 0);
                return {
                  ...t,
                  available: Math.max(0, (oldTicket.available || 0) + capDiff)
                };
              }
              return t;
            });
          }
          await updateDoc(eventRef, eventData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}`);
        }
        toast.success('Event updated successfully!');
      } else {
        try {
          eventData.availableSeats = totalSeats;
          eventData.soldCount = 0;
          eventData.createdAt = serverTimestamp();
          await addDoc(collection(db, 'events'), eventData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'events');
        }
        toast.success('Event created successfully!');
      }
      navigate('/dashboard');
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary mb-8 transition-colors font-bold"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Back to Dashboard
      </button>

      <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 sm:p-12 shadow-xl border border-outline-variant/10">
        <h1 className="text-4xl font-black text-on-surface mb-8 tracking-tighter font-headline">
          {eventId ? 'Edit Event' : 'Host a New Event'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Event Title</label>
              <input 
                required
                type="text" 
                placeholder="e.g. Annual Tech Symposium 2026"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Description</label>
              <textarea 
                required
                rows={4}
                placeholder="Tell people what your event is about..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Date</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">calendar_today</span>
                <input 
                  required
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Time</label>
              <input 
                required
                type="time" 
                value={formData.time}
                onChange={(e) => setFormData({...formData, time: e.target.value})}
                className="w-full px-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Booking Close Date (Optional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">event_busy</span>
                <input 
                  type="date" 
                  value={formData.bookingCloseDate}
                  onChange={(e) => setFormData({...formData, bookingCloseDate: e.target.value})}
                  className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Booking Close Time (Optional)</label>
              <input 
                type="time" 
                value={formData.bookingCloseTime}
                onChange={(e) => setFormData({...formData, bookingCloseTime: e.target.value})}
                className="w-full px-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">City</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">location_city</span>
                <select 
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value, venue: ''})}
                  className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium appearance-none"
                >
                  <option value="">Select a city</option>
                  {INDIAN_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Venue / Location</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">location_on</span>
                {formData.city && CITY_COLLEGES[formData.city] ? (
                  <select
                    required
                    value={formData.venue}
                    onChange={(e) => setFormData({...formData, venue: e.target.value})}
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium appearance-none"
                  >
                    <option value="">Select a venue</option>
                    {CITY_COLLEGES[formData.city].map(college => (
                      <option key={college} value={college}>{college}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Main Auditorium, Block C"
                    value={formData.venue}
                    onChange={(e) => setFormData({...formData, venue: e.target.value})}
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold font-headline">Ticket Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {formData.ticketTypes.map((ticket, index) => (
                <div 
                  key={ticket.id} 
                  className={cn(
                    "p-6 rounded-2xl border transition-all space-y-4",
                    ticket.enabled 
                      ? "bg-surface-container-low border-outline-variant/15" 
                      : "bg-surface-container border-transparent opacity-60"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        checked={ticket.enabled}
                        onChange={(e) => {
                          const newTypes = [...formData.ticketTypes];
                          newTypes[index].enabled = e.target.checked;
                          setFormData({...formData, ticketTypes: newTypes});
                        }}
                        className="w-5 h-5 rounded border-outline-variant/30 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-bold">{ticket.name}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                      ticket.type === 'early' ? "bg-primary/10 text-primary" :
                      ticket.type === 'vip' ? "bg-tertiary/10 text-tertiary" :
                      "bg-on-surface/5 text-on-surface-variant"
                    )}>
                      {ticket.type}
                    </span>
                  </div>
                  
                  {ticket.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Price (₹)</label>
                        <input 
                          type="number"
                          min="0"
                          value={ticket.price}
                          onChange={(e) => {
                            const newTypes = [...formData.ticketTypes];
                            newTypes[index].price = Number(e.target.value);
                            setFormData({...formData, ticketTypes: newTypes});
                          }}
                          className="w-full px-4 py-2 bg-surface-container border border-outline-variant/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tickets</label>
                        <input 
                          type="number"
                          min="1"
                          value={ticket.capacity}
                          onChange={(e) => {
                            const newTypes = [...formData.ticketTypes];
                            newTypes[index].capacity = Number(e.target.value);
                            setFormData({...formData, ticketTypes: newTypes});
                          }}
                          className="w-full px-4 py-2 bg-surface-container border border-outline-variant/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-bold"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-on-surface-variant italic">{ticket.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Category</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">tag</span>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none font-medium"
              >
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Cover Image URL (Optional)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant">image</span>
              <input 
                type="url" 
                placeholder="https://images.unsplash.com/..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                className="w-full pl-12 pr-6 py-4 bg-surface-container-low border border-outline-variant/15 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-medium"
              />
            </div>
          </div>

          <div className="pt-8 flex gap-4">
            <button 
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-4 bg-surface-container text-on-surface font-bold rounded-2xl hover:bg-surface-container-high transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 bg-primary text-on-primary font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : (eventId ? 'Update Event' : 'Launch Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
