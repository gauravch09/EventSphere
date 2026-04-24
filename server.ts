import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Event Sphere API is running" });
  });

  app.post("/api/send-ticket", async (req, res) => {
    const { attendeeEmail, attendeeName, eventTitle, eventDate, ticketTypeName, ticketCount, totalPrice, bookingId } = req.body;

    try {
      // Generate QR Code as Data URL
      const qrCodeDataUrl = await QRCode.toDataURL(bookingId);

      // Create a transporter (using a mock/log approach for demo, but real code structure)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'test@example.com',
          pass: process.env.SMTP_PASS || 'password',
        },
      });

      // For this environment, if no SMTP is provided, we'll just log it
      if (!process.env.SMTP_HOST) {
        console.log("------------------------------------------");
        console.log(`MOCK EMAIL SENT TO: ${attendeeEmail}`);
        console.log(`SUBJECT: Ticket Confirmation - ${eventTitle}`);
        console.log(`CONTENT: Hi ${attendeeName}, your ${ticketCount} ${ticketTypeName} ticket(s) for ${eventTitle} are confirmed!`);
        console.log(`QR CODE DATA: ${qrCodeDataUrl.substring(0, 50)}...`);
        console.log("------------------------------------------");
        
        return res.json({ 
          success: true, 
          message: "Email simulated (logged to console). Add SMTP credentials to .env for real delivery.",
          mock: true
        });
      }

      const mailOptions = {
        from: '"Event Sphere" <tickets@eventsphere.com>',
        to: attendeeEmail,
        subject: `Ticket Confirmation - ${eventTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h1 style="color: #6200ee; text-align: center;">Event Sphere</h1>
            <p>Hi <strong>${attendeeName}</strong>,</p>
            <p>Your booking for <strong>${eventTitle}</strong> is confirmed!</p>
            
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Event:</strong> ${eventTitle}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
              <p style="margin: 5px 0;"><strong>Ticket:</strong> ${ticketCount} x ${ticketTypeName}</p>
              <p style="margin: 5px 0;"><strong>Total Paid:</strong> ₹${totalPrice}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p>Show this QR code at the entrance:</p>
              <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px;" />
            </div>

            <p style="font-size: 12px; color: #666; text-align: center;">
              Thank you for using Event Sphere. Enjoy your event!
            </p>
          </div>
        `,
        attachments: [
          {
            filename: 'ticket-qr.png',
            content: qrCodeDataUrl.split("base64,")[1],
            encoding: 'base64',
            cid: 'qrcode'
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ success: false, error: "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
