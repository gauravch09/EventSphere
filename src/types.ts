export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'organizer' | 'admin';
  city?: string;
  createdAt: any; // Firestore Timestamp
}

export interface TicketType {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'early' | 'regular' | 'vip' | 'group';
  enabled: boolean;
  capacity: number;
  available?: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: any; // Firestore Timestamp
  bookingCloseTime?: any; // Firestore Timestamp
  venue: string;
  city: string;
  category: string;
  imageUrl: string;
  totalSeats: number;
  availableSeats: number;
  soldCount: number;
  ticketTypes: TicketType[];
  organizerId: string;
  organizerName: string;
  createdAt: any; // Firestore Timestamp
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventDate: any; // Firestore Timestamp
  ticketCount: number;
  ticketTypeId: string;
  ticketTypeName: string;
  totalPrice: number;
  qrCode: string;
  attendeeName: string;
  attendeeEmail: string;
  status: 'confirmed' | 'used' | 'cancelled';
  createdAt: any; // Firestore Timestamp
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any; // Firestore Timestamp
  type: string;
}
