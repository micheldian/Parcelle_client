/**
 * Abstraction de notification de la main d'œuvre.
 * Implémentation actuelle : Telegram Bot API.
 * Pour ajouter WhatsApp plus tard : créer une nouvelle classe
 * implémentant `Notifier` et changer `creerNotifier()` — rien d'autre à toucher.
 */
import "server-only";

export interface Notifier {
  /** Envoie un message texte au canal de l'équipe. */
  envoyerMessage(texte: string): Promise<void>;
  /** Envoie une position GPS cliquable (itinéraire en un tap). */
  envoyerPosition(latitude: number, longitude: number): Promise<void>;
}

/** Implémentation Telegram (sendMessage + sendLocation). */
class TelegramNotifier implements Notifier {
  constructor(
    private readonly token: string,
    private readonly chatId: string
  ) {}

  private async appeler(methode: string, corps: Record<string, unknown>): Promise<void> {
    const reponse = await fetch(`https://api.telegram.org/bot${this.token}/${methode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, ...corps }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      throw new Error(`Telegram ${methode} : HTTP ${reponse.status} ${detail}`);
    }
  }

  async envoyerMessage(texte: string): Promise<void> {
    await this.appeler("sendMessage", { text: texte, parse_mode: "HTML" });
  }

  async envoyerPosition(latitude: number, longitude: number): Promise<void> {
    await this.appeler("sendLocation", { latitude, longitude });
  }
}

/** Fabrique le notifier configuré (lève une erreur claire si l'env est incomplet). */
export function creerNotifier(): Notifier {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_DISPATCH_CHAT_ID;
  if (!token || !chatId) {
    throw new Error(
      "Telegram non configuré : renseignez TELEGRAM_BOT_TOKEN et TELEGRAM_DISPATCH_CHAT_ID"
    );
  }
  return new TelegramNotifier(token, chatId);
}
