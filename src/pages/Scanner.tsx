import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { X, Info } from 'lucide-react';

const Scanner: React.FC = () => {
  const { user, profile, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<any>(null);
  const isProcessingRef = React.useRef(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      navigate('/');
      return;
    }

    // Redirect if not an organizer
    const isOrganizer = profile?.email === 'gy426408@gmail.com' || profile?.role === 'admin' || profile?.role === 'organizer';
    if (!isOrganizer) {
      navigate('/');
      toast.error('Access denied. Organizer privileges required.');
      return;
    }

    const scanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, onScanFailure);

    async function onScanSuccess(decodedText: string) {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      
      try {
        // The QR code contains the booking ID
        const bookingId = decodedText;
        const bookingRef = doc(db, 'bookings', bookingId);
        let bookingSnap;
        try {
          bookingSnap = await getDoc(bookingRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `bookings/${bookingId}`);
          return;
        }

        if (bookingSnap.exists()) {
          const bookingData = bookingSnap.data();
          
          if (bookingData.status === 'used') {
            setScanResult({ status: 'error', message: 'Ticket already used!' });
            toast.error('Ticket already used!');
          } else if (bookingData.status === 'cancelled') {
            setScanResult({ status: 'error', message: 'Ticket has been cancelled!' });
            toast.error('Ticket has been cancelled!');
          } else {
            // Mark as used
            try {
              await updateDoc(bookingRef, { status: 'used' });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
            }
            toast.success('Ticket Validated Successfully!');
            
            // Navigate instantly
            navigate(`/booking/${bookingId}`);
          }
        } else {
          setScanResult({ status: 'error', message: 'Invalid Ticket QR Code' });
          toast.error('Invalid Ticket');
        }
      } catch (error) {
        console.error('Scan error:', error);
        toast.error('Error validating ticket');
      } finally {
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 2500);
      }
    }

    function onScanFailure(error: any) {
      // Ignore scan failures
    }

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    };
  }, [user, isAuthReady, navigate, profile]);

  if (!user) return null;

  return (
    <main className="min-h-[80vh] bg-background flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-md">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black font-headline tracking-tighter text-on-surface">Scan Ticket</h1>
            <p className="text-on-surface-variant text-sm font-medium mt-1">Point camera at the QR code</p>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors text-on-surface"
          >
            <X size={20} />
          </button>
        </header>

        <div className="bg-surface-container-lowest rounded-[2rem] shadow-2xl border border-outline-variant/10 overflow-hidden relative">
          {/* Scanner Viewfinder */}
          <div className="relative bg-surface-container-lowest w-full overflow-hidden flex flex-col items-center justify-center">
            <div id="reader" className="w-full h-full [&>div]:border-none [&_video]:object-cover"></div>
            
            {/* Overlay UI for the scanner (only visible when camera is active, but we'll just put it over the video area if possible. Actually html5-qrcode handles its own UI. Let's just use CSS to style it.) */}
          </div>

          <div className="p-6 bg-surface-container-lowest border-t border-outline-variant/10">
            <AnimatePresence mode="wait">
              {scanResult && scanResult.status === 'error' ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-error-container/20 border border-error/30 p-4 rounded-xl flex items-start gap-3 text-error"
                >
                  <span className="material-symbols-outlined mt-0.5">error</span>
                  <div>
                    <h3 className="font-bold">{scanResult.message}</h3>
                    <button 
                      onClick={() => setScanResult(null)}
                      className="mt-2 text-xs font-bold uppercase tracking-widest underline opacity-80 hover:opacity-100"
                    >
                      Scan Another
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="info"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-3 text-on-surface-variant text-sm"
                >
                  <Info size={20} className="text-primary shrink-0 mt-0.5" />
                  <p>Hold your device steady. The scanner will automatically detect and validate the ticket.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Global styles to override html5-qrcode default ugly UI */}
      <style>{`
        #reader {
          border: none !important;
          width: 100% !important;
          position: relative;
        }
        #reader__scan_region {
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
        }
        #reader__dashboard_section_csr span {
          font-family: inherit !important;
        }
        #reader__dashboard_section_swaplink {
          color: var(--color-primary) !important;
          text-decoration: none !important;
          font-weight: bold !important;
        }
        #reader button {
          background-color: var(--color-primary) !important;
          color: var(--color-on-primary) !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 99px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          margin: 8px !important;
        }
        #reader select {
          padding: 8px !important;
          border-radius: 8px !important;
          margin-bottom: 8px !important;
          max-width: 100%;
          background: var(--color-surface-container-low);
          border: 1px solid rgba(0,0,0,0.1);
        }
        #reader__dashboard {
          padding: 16px !important;
        }
        #reader__dashboard_section_csr {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </main>
  );
};

export default Scanner;
