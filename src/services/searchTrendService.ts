import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { generateEventSuggestion } from './geminiService';

const SEARCH_THRESHOLD = 3; // Lowered for easier demo

export async function logSearch(term: string) {
  if (!term || term.trim().length < 3) return;

  const normalizedTerm = term.toLowerCase().trim();
  const searchLogsRef = collection(db, 'search_logs');
  const q = query(searchLogsRef, where('term', '==', normalizedTerm));
  
  try {
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await addDoc(searchLogsRef, {
        term: normalizedTerm,
        count: 1,
        lastSearched: serverTimestamp(),
        suggestionSent: false
      });
    } else {
      const logDoc = querySnapshot.docs[0];
      const data = logDoc.data();
      const newCount = data.count + 1;
      
      await updateDoc(doc(db, 'search_logs', logDoc.id), {
        count: newCount,
        lastSearched: serverTimestamp()
      });

      if (newCount >= SEARCH_THRESHOLD && !data.suggestionSent) {
        await triggerAISuggestion(normalizedTerm, logDoc.id);
      }
    }
  } catch (error) {
    console.error("Error logging search:", error);
  }
}

async function triggerAISuggestion(term: string, logId: string) {
  try {
    // Mark as sent first to avoid duplicate triggers
    await updateDoc(doc(db, 'search_logs', logId), { suggestionSent: true });

    const suggestion = await generateEventSuggestion(term);
    if (!suggestion) return;

    // Notify all organizers and admins
    const usersRef = collection(db, 'users');
    const organizersQuery = query(usersRef, where('role', 'in', ['organizer', 'admin']));
    const organizersSnapshot = await getDocs(organizersQuery);

    const notificationsRef = collection(db, 'notifications');
    
    const promises = organizersSnapshot.docs.map(organizerDoc => {
      return addDoc(notificationsRef, {
        userId: organizerDoc.id,
        title: `Trend Alert: ${suggestion.title}`,
        message: `Many users are searching for "${term}". How about creating this event: ${suggestion.description}. Suggested Venue: ${suggestion.suggestedVenue}`,
        type: 'suggestion',
        read: false,
        createdAt: serverTimestamp()
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error triggering AI suggestion:", error);
  }
}
