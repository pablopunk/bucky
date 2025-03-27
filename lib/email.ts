import nodemailer from "nodemailer";
import { getDatabase } from "./db";
import type { SMTPConfig } from "./db";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  smtpConfig?: {
    host: string;
    port: number;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
}

export async function sendEmail(options: EmailOptions): Promise<void>;
export async function sendEmail(to: string, subject: string, body: string): Promise<void>;
export async function sendEmail(...args: any[]): Promise<void> {
  try {
    let to: string, subject: string, html: string, smtpConfig: any;

    // Check if first argument is an object (options pattern)
    if (typeof args[0] === 'object') {
      const options = args[0] as EmailOptions;
      to = options.to;
      subject = options.subject;
      html = options.html;
      
      if (options.smtpConfig) {
        // Use directly provided SMTP config
        smtpConfig = {
          host: options.smtpConfig.host,
          port: options.smtpConfig.port,
          secure: options.smtpConfig.port === 465,
          auth: options.smtpConfig.auth
        };
        
        const transporter = nodemailer.createTransport(smtpConfig);
        
        await transporter.sendMail({
          from: options.smtpConfig.from,
          to,
          subject,
          html,
          text: options.text
        });
        
        return;
      }
    } else {
      // Traditional parameters
      to = args[0];
      subject = args[1];
      html = args[2];
    }

    // Get SMTP config from database
    const db = getDatabase();
    const dbSmtpConfig = db.prepare("SELECT * FROM smtp_config ORDER BY id DESC LIMIT 1").get() as SMTPConfig | null;

    if (!dbSmtpConfig) {
      throw new Error("SMTP configuration not found");
    }

    const transporter = nodemailer.createTransport({
      host: dbSmtpConfig.host,
      port: dbSmtpConfig.port,
      secure: dbSmtpConfig.port === 465,
      auth: {
        user: dbSmtpConfig.username,
        pass: dbSmtpConfig.password,
      },
    });

    await transporter.sendMail({
      from: `"${dbSmtpConfig.from_name}" <${dbSmtpConfig.from_email}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

export async function sendBackupNotification(
  jobName: string,
  status: "success" | "failed",
  message: string,
  to: string
): Promise<void> {
  const subject = `Backup ${status === "success" ? "Successful" : "Failed"}: ${jobName}`;
  const text = `
Backup Job: ${jobName}
Status: ${status}
Time: ${new Date().toLocaleString()}

${message}
`;
  const html = `
<h1>Backup ${status === "success" ? "Successful" : "Failed"}</h1>
<p><strong>Backup Job:</strong> ${jobName}</p>
<p><strong>Status:</strong> ${status}</p>
<p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
<p>${message}</p>
`;

  await sendEmail(to, subject, html);
}

export async function sendQuotaWarning(
  providerName: string,
  usedSpace: number,
  totalSpace: number,
  to: string
): Promise<void> {
  const usagePercentage = Math.round((usedSpace / totalSpace) * 100);
  const subject = `Storage Quota Warning: ${providerName}`;
  const text = `
Storage Provider: ${providerName}
Current Usage: ${usagePercentage}%
Used Space: ${formatBytes(usedSpace)}
Total Space: ${formatBytes(totalSpace)}

Your storage space is running low. Please take action to prevent backup failures.
`;
  const html = `
<h1>Storage Quota Warning</h1>
<p><strong>Storage Provider:</strong> ${providerName}</p>
<p><strong>Current Usage:</strong> ${usagePercentage}%</p>
<p><strong>Used Space:</strong> ${formatBytes(usedSpace)}</p>
<p><strong>Total Space:</strong> ${formatBytes(totalSpace)}</p>
<p>Your storage space is running low. Please take action to prevent backup failures.</p>
`;

  await sendEmail(to, subject, html);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
} 