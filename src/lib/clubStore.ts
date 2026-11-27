import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdminStudent,
  InboxMessage,
  InboxMessageStatus,
  NewsItem,
  PublicIdea,
  PublicPointEvent,
  SiteConfig,
  StudentAiMessage,
  StudentSession,
} from '../types';

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  maintenanceEnabled: false,
  maintenanceTitle: 'Технические работы в Layf1x-TOP',
  maintenanceMessage: 'Мы обновляем рейтинг и расписание. Сайт скоро снова станет доступен.',
  maintenanceUntil: '',
  snowEnabled: false,
};

export const MAX_NEWS_FILE_BYTES = 650 * 1024; // ~650 KB raw -> fits safely in Firestore 1 MiB doc

export function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export function generateDocId(prefix: string): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export async function computeStudentAuthKey(username: string, password: string): Promise<string> {
  const normalized = `${username.trim().toLowerCase()}:${password}:layf1x-v1`;
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ===========================================================================
// Real-time Subscriptions (Sync across PC, Phone & all open tabs instantly)
// ===========================================================================

export function subscribeSiteConfig(
  onData: (config: SiteConfig) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const ref = doc(db, 'site_config', 'main');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({ ...DEFAULT_SITE_CONFIG });
        return;
      }
      const d = snap.data();
      onData({
        maintenanceEnabled: Boolean(d.maintenanceEnabled),
        maintenanceTitle:
          typeof d.maintenanceTitle === 'string' && d.maintenanceTitle.trim()
            ? d.maintenanceTitle
            : DEFAULT_SITE_CONFIG.maintenanceTitle,
        maintenanceMessage:
          typeof d.maintenanceMessage === 'string'
            ? d.maintenanceMessage
            : DEFAULT_SITE_CONFIG.maintenanceMessage,
        maintenanceUntil: typeof d.maintenanceUntil === 'string' ? d.maintenanceUntil : '',
        snowEnabled: Boolean(d.snowEnabled),
      });
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'site_config/main');
    }
  );
}

export interface RawStudentDoc {
  id: string;
  fullName: string;
  username: string;
  groupName: string;
  pieceSymbol: string;
  totalPoints: number;
  eventsCount: number;
  active: boolean;
  aiEnabled: boolean;
  createdAt: string;
}

export function subscribePublicStudents(
  onData: (students: RawStudentDoc[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'students'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list: RawStudentDoc[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          fullName: String(d.fullName ?? ''),
          username: String(d.username ?? ''),
          groupName: String(d.groupName ?? 'Начинающие'),
          pieceSymbol: String(d.pieceSymbol ?? '♞'),
          totalPoints: Number(d.totalPoints) || 0,
          eventsCount: Number(d.eventsCount) || 0,
          active: Boolean(d.active),
          aiEnabled: Boolean(d.aiEnabled),
          createdAt: timestampToIso(d.createdAt),
        };
      });
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'students');
    }
  );
}

export function subscribePointEvents(
  isAdmin: boolean,
  onData: (events: PublicPointEvent[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = isAdmin
    ? collection(db, 'point_events')
    : query(collection(db, 'point_events'), where('delta', '!=', 0));
  return onSnapshot(
    q,
    (snap) => {
      const list: PublicPointEvent[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            studentId: String(d.studentId ?? ''),
            studentName: String(d.studentName ?? ''),
            groupName: String(d.groupName ?? ''),
            delta: Number(d.delta) || 0,
            category: String(d.category ?? 'Занятие'),
            reason: String(d.reason ?? ''),
            eventDate: String(d.eventDate ?? ''),
            createdAt: timestampToIso(d.createdAt),
          };
        })
        .sort(
          (a, b) =>
            b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt)
        );
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'point_events');
    }
  );
}

export function subscribePublicNews(
  onData: (news: NewsItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'news'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list: NewsItem[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          const fName = typeof d.fileName === 'string' && d.fileName ? d.fileName : null;
          return {
            id: docSnap.id,
            title: String(d.title ?? ''),
            body: String(d.body ?? ''),
            fileName: fName,
            fileSize: fName ? Number(d.fileSize) || null : null,
            fileMime: typeof d.fileMime === 'string' ? d.fileMime : null,
            hasFile: Boolean(d.hasFile && fName),
            active: Boolean(d.active),
            createdAt: timestampToIso(d.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'news');
    }
  );
}

export function subscribeAdminNews(
  onData: (news: NewsItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'news'),
    (snap) => {
      const list: NewsItem[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          const fName = typeof d.fileName === 'string' && d.fileName ? d.fileName : null;
          return {
            id: docSnap.id,
            title: String(d.title ?? ''),
            body: String(d.body ?? ''),
            fileName: fName,
            fileSize: fName ? Number(d.fileSize) || null : null,
            fileMime: typeof d.fileMime === 'string' ? d.fileMime : null,
            hasFile: Boolean(d.hasFile && fName),
            active: Boolean(d.active),
            createdAt: timestampToIso(d.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'news');
    }
  );
}

export function subscribeAdminStudents(
  onData: (students: AdminStudent[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let publicList: RawStudentDoc[] = [];
  let privateMap = new Map<string, { notes: string; authKey: string }>();
  let gotPublic = false;

  const emit = () => {
    if (!gotPublic) return;
    const merged: AdminStudent[] = publicList
      .map((s) => {
        const priv = privateMap.get(s.id);
        return {
          ...s,
          notes: priv?.notes ?? '',
          authKey: priv?.authKey ?? '',
        };
      })
      .sort(
        (a, b) =>
          b.totalPoints - a.totalPoints || a.fullName.localeCompare(b.fullName, 'ru')
      );
    onData(merged);
  };

  const unsubPub = onSnapshot(
    collection(db, 'students'),
    (snap) => {
      publicList = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          fullName: String(d.fullName ?? ''),
          username: String(d.username ?? ''),
          groupName: String(d.groupName ?? 'Начинающие'),
          pieceSymbol: String(d.pieceSymbol ?? '♞'),
          totalPoints: Number(d.totalPoints) || 0,
          eventsCount: Number(d.eventsCount) || 0,
          active: Boolean(d.active),
          aiEnabled: Boolean(d.aiEnabled),
          createdAt: timestampToIso(d.createdAt),
        };
      });
      gotPublic = true;
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'students');
    }
  );

  const unsubPriv = onSnapshot(
    collection(db, 'students_private'),
    (snap) => {
      const next = new Map<string, { notes: string; authKey: string }>();
      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        next.set(docSnap.id, {
          notes: String(d.notes ?? ''),
          authKey: String(d.authKey ?? ''),
        });
      }
      privateMap = next;
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'students_private');
    }
  );

  return () => {
    unsubPub();
    unsubPriv();
  };
}

export function subscribePublicIdeas(
  currentStudentId: string | null,
  onData: (ideas: PublicIdea[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let rawIdeas: Array<{
    id: string;
    studentId: string;
    authorName: string;
    subject: string;
    message: string;
    status: InboxMessageStatus;
    createdAt: string;
  }> = [];
  let rawVotes: Array<{ ideaId: string; studentId: string; direction: 1 | -1 }> = [];
  let ideasLoaded = false;

  const emit = () => {
    if (!ideasLoaded) return;
    const voteStats = new Map<string, { up: number; down: number; myVote: -1 | 0 | 1 }>();
    for (const v of rawVotes) {
      const entry = voteStats.get(v.ideaId) ?? { up: 0, down: 0, myVote: 0 };
      if (v.direction === 1) entry.up += 1;
      if (v.direction === -1) entry.down += 1;
      if (currentStudentId && v.studentId === currentStudentId) {
        entry.myVote = v.direction;
      }
      voteStats.set(v.ideaId, entry);
    }

    const combined: PublicIdea[] = rawIdeas
      .map((idea) => {
        const st = voteStats.get(idea.id) ?? { up: 0, down: 0, myVote: 0 };
        return {
          id: idea.id,
          studentId: idea.studentId,
          authorName: idea.authorName,
          subject: idea.subject,
          message: idea.message,
          status: idea.status,
          upvotes: st.up,
          downvotes: st.down,
          score: st.up - st.down,
          userVote: st.myVote,
          createdAt: idea.createdAt,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score || b.upvotes - a.upvotes || b.createdAt.localeCompare(a.createdAt)
      );
    onData(combined);
  };

  const ideasQ = query(
    collection(db, 'ideas'),
    where('status', 'in', ['new', 'accepted', 'in_progress', 'done'])
  );
  const votesQ = query(collection(db, 'idea_votes'), where('direction', 'in', [1, -1]));

  const unsubIdeas = onSnapshot(
    ideasQ,
    (snap) => {
      rawIdeas = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          studentId: String(d.studentId ?? docSnap.id),
          authorName: String(d.authorName ?? ''),
          subject: String(d.subject ?? ''),
          message: String(d.message ?? ''),
          status: (d.status as InboxMessageStatus) || 'new',
          createdAt: timestampToIso(d.createdAt),
        };
      });
      ideasLoaded = true;
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'ideas');
    }
  );

  const unsubVotes = onSnapshot(
    votesQ,
    (snap) => {
      rawVotes = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          ideaId: String(d.ideaId ?? ''),
          studentId: String(d.studentId ?? ''),
          direction: d.direction === -1 ? -1 : 1,
        };
      });
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'idea_votes');
    }
  );

  return () => {
    unsubIdeas();
    unsubVotes();
  };
}

export function subscribeAdminInbox(
  onData: (messages: InboxMessage[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let ideas: Array<{
    id: string;
    studentId: string;
    authorName: string;
    subject: string;
    message: string;
    status: InboxMessageStatus;
    createdAt: string;
  }> = [];
  let ideaNotes = new Map<string, string>();
  let votes: Array<{ ideaId: string; direction: 1 | -1 }> = [];
  let support: InboxMessage[] = [];

  const emit = () => {
    const voteCounts = new Map<string, { up: number; down: number }>();
    for (const v of votes) {
      const entry = voteCounts.get(v.ideaId) ?? { up: 0, down: 0 };
      if (v.direction === 1) entry.up += 1;
      else entry.down += 1;
      voteCounts.set(v.ideaId, entry);
    }

    const ideaMessages: InboxMessage[] = ideas.map((idea) => {
      const vc = voteCounts.get(idea.id) ?? { up: 0, down: 0 };
      return {
        id: idea.id,
        kind: 'idea',
        studentId: idea.studentId,
        authorName: idea.authorName,
        authorContact: '',
        subject: idea.subject,
        message: idea.message,
        status: idea.status,
        adminNote: ideaNotes.get(idea.id) ?? '',
        upvotes: vc.up,
        downvotes: vc.down,
        createdAt: idea.createdAt,
      };
    });

    const combined = [...ideaMessages, ...support].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    onData(combined);
  };

  const unsubIdeas = onSnapshot(
    collection(db, 'ideas'),
    (snap) => {
      ideas = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          studentId: String(d.studentId ?? docSnap.id),
          authorName: String(d.authorName ?? ''),
          subject: String(d.subject ?? ''),
          message: String(d.message ?? ''),
          status: (d.status as InboxMessageStatus) || 'new',
          createdAt: timestampToIso(d.createdAt),
        };
      });
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'ideas');
    }
  );

  const unsubNotes = onSnapshot(
    collection(db, 'ideas_admin'),
    (snap) => {
      const next = new Map<string, string>();
      for (const docSnap of snap.docs) {
        next.set(docSnap.id, String(docSnap.data().adminNote ?? ''));
      }
      ideaNotes = next;
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'ideas_admin');
    }
  );

  const unsubVotes = onSnapshot(
    collection(db, 'idea_votes'),
    (snap) => {
      votes = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          ideaId: String(d.ideaId ?? ''),
          direction: d.direction === -1 ? -1 : 1,
        };
      });
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'idea_votes');
    }
  );

  const unsubSupport = onSnapshot(
    collection(db, 'support_messages'),
    (snap) => {
      support = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          kind: 'support',
          authorName: String(d.authorName ?? ''),
          authorContact: String(d.authorContact ?? ''),
          subject: String(d.subject ?? ''),
          message: String(d.message ?? ''),
          status: (d.status as InboxMessageStatus) || 'new',
          adminNote: String(d.adminNote ?? ''),
          upvotes: 0,
          downvotes: 0,
          createdAt: timestampToIso(d.createdAt),
        };
      });
      emit();
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.LIST, 'support_messages');
    }
  );

  return () => {
    unsubIdeas();
    unsubNotes();
    unsubVotes();
    unsubSupport();
  };
}

// ===========================================================================
// Student Non-Google Login & Actions
// ===========================================================================

export async function loginStudentWithCredentials(
  username: string,
  password: string
): Promise<StudentSession> {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || !password) {
    throw new Error('Введите логин и пароль ученика');
  }
  const authKey = await computeStudentAuthKey(cleanUser, password);
  const path = `student_auth/${authKey}`;
  try {
    const snap = await getDoc(doc(db, 'student_auth', authKey));
    if (!snap.exists()) {
      throw new Error('Неверный логин или пароль');
    }
    const data = snap.data();
    if (!data.active) {
      throw new Error('Аккаунт ученика отключён тренером');
    }
    return {
      studentId: String(data.studentId),
      authKey,
      username: String(data.username || cleanUser),
    };
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Неверный') || err.message.includes('отключён'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function downloadNewsFile(newsId: string, fallbackName: string): Promise<void> {
  const path = `news_files/${newsId}`;
  try {
    const snap = await getDoc(doc(db, 'news_files', newsId));
    if (!snap.exists()) {
      throw new Error('Файл не найден');
    }
    const data = snap.data();
    const base64 = String(data.dataBase64 ?? '');
    const fileName = String(data.fileName ?? fallbackName);
    const mime = String(data.fileMime ?? 'application/octet-stream');

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (err) {
    if (err instanceof Error && err.message === 'Файл не найден') {
      throw err;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function submitStudentIdea(
  session: StudentSession,
  authorName: string,
  subject: string,
  message: string
): Promise<void> {
  const ideaId = session.studentId;
  const proofId = `idea_${ideaId}`;
  const cleanName = authorName.trim().slice(0, 100);
  const cleanSubject = subject.trim().slice(0, 160);
  const cleanMessage = message.trim().slice(0, 2000);

  if (cleanName.length < 2) throw new Error('Имя должно содержать минимум 2 символа');
  if (cleanSubject.length < 2) throw new Error('Укажите название идеи (минимум 2 символа)');
  if (cleanMessage.length < 5) throw new Error('Опишите идею подробнее (минимум 5 символов)');

  // Check first so we show a friendly Russian message if student already submitted 1 idea
  const existingSnap = await getDoc(doc(db, 'ideas', ideaId));
  if (existingSnap.exists()) {
    throw new Error('Вы уже предложили свою идею (правило клуба: 1 ученик — 1 идея).');
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'student_proofs', proofId), {
      authKey: session.authKey,
      studentId: session.studentId,
      action: 'idea',
      targetId: ideaId,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'ideas', ideaId), {
      studentId: session.studentId,
      authorName: cleanName,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `ideas/${ideaId}`);
  }
}

export async function castStudentIdeaVote(
  session: StudentSession,
  ideaId: string,
  direction: 1 | -1
): Promise<void> {
  const voteId = `${ideaId}_${session.studentId}`;
  const proofId = `vote_${voteId}`;

  const existingVote = await getDoc(doc(db, 'idea_votes', voteId));
  if (existingVote.exists()) {
    throw new Error('Вы уже голосовали за эту идею (1 ученик может проголосовать 1 раз).');
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'student_proofs', proofId), {
      authKey: session.authKey,
      studentId: session.studentId,
      action: 'vote',
      targetId: voteId,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'idea_votes', voteId), {
      ideaId,
      studentId: session.studentId,
      direction,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `idea_votes/${voteId}`);
  }
}

export async function submitSupportMessage(
  authorName: string,
  authorContact: string,
  subject: string,
  message: string
): Promise<string> {
  const cleanName = authorName.trim().slice(0, 100);
  const cleanContact = authorContact.trim().slice(0, 120);
  const cleanSubject = subject.trim().slice(0, 160);
  const cleanMessage = message.trim().slice(0, 2000);

  if (cleanName.length < 2) throw new Error('Укажите ваше имя (минимум 2 символа)');
  if (cleanSubject.length < 2) throw new Error('Укажите тему обращения');
  if (cleanMessage.length < 5) throw new Error('Опишите проблему подробнее (минимум 5 символов)');

  const msgId = generateDocId('sup');
  try {
    await setDoc(doc(db, 'support_messages', msgId), {
      authorName: cleanName,
      authorContact: cleanContact,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'new',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return msgId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `support_messages/${msgId}`);
  }
}

// ===========================================================================
// Student AI Chat History (Synced across PC & Phone in Firestore)
// ===========================================================================

export async function loadStudentAiHistory(authKey: string): Promise<StudentAiMessage[]> {
  const path = `student_ai_chats/${authKey}`;
  try {
    const snap = await getDoc(doc(db, 'student_ai_chats', authKey));
    if (!snap.exists()) return [];
    const data = snap.data();
    const raw = Array.isArray(data.messages) ? data.messages : [];
    return raw.map((m: Record<string, unknown>, idx: number) => ({
      id: typeof m.id === 'string' ? m.id : `msg_${idx}`,
      role: m.role === 'model' ? 'model' : 'user',
      content: String(m.content ?? ''),
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveStudentAiHistory(
  authKey: string,
  studentId: string,
  messages: StudentAiMessage[]
): Promise<void> {
  const path = `student_ai_chats/${authKey}`;
  const bounded = messages.slice(-40).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content.slice(0, 6000),
    createdAt: m.createdAt,
  }));
  try {
    await setDoc(doc(db, 'student_ai_chats', authKey), {
      studentId,
      messages: bounded,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function clearStudentAiHistory(authKey: string): Promise<void> {
  const path = `student_ai_chats/${authKey}`;
  try {
    await deleteDoc(doc(db, 'student_ai_chats', authKey));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ===========================================================================
// Admin Mutations (Protected by Firestore isAdmin() rules)
// ===========================================================================

export async function saveSiteConfig(config: SiteConfig): Promise<void> {
  const path = 'site_config/main';
  try {
    await setDoc(doc(db, 'site_config', 'main'), {
      maintenanceEnabled: Boolean(config.maintenanceEnabled),
      maintenanceTitle:
        config.maintenanceTitle.trim().slice(0, 140) || DEFAULT_SITE_CONFIG.maintenanceTitle,
      maintenanceMessage: config.maintenanceMessage.trim().slice(0, 600),
      maintenanceUntil: config.maintenanceUntil.trim().slice(0, 80),
      snowEnabled: Boolean(config.snowEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createStudentAccount(params: {
  fullName: string;
  username: string;
  password: string;
  groupName: string;
  pieceSymbol: string;
  initialPoints: number;
  notes: string;
  aiEnabled: boolean;
  existingUsernames: string[];
  todayIso: string;
}): Promise<void> {
  const cleanName = params.fullName.trim().slice(0, 100);
  const cleanUsername = params.username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 40);
  const cleanPassword = params.password;

  if (cleanName.length < 2) throw new Error('Имя ученика должно содержать минимум 2 символа');
  if (cleanUsername.length < 2) {
    throw new Error('Логин должен содержать минимум 2 латинских символа');
  }
  if (cleanPassword.length < 4) throw new Error('Пароль должен содержать минимум 4 символа');
  if (params.existingUsernames.includes(cleanUsername)) {
    throw new Error('Ученик с таким логином уже существует');
  }

  const studentId = generateDocId('stu');
  const authKey = await computeStudentAuthKey(cleanUsername, cleanPassword);
  const startPoints = Math.trunc(Number(params.initialPoints) || 0);
  const hasStartPoints = startPoints !== 0;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', studentId), {
      fullName: cleanName,
      username: cleanUsername,
      groupName: params.groupName.trim().slice(0, 60) || 'Начинающие',
      pieceSymbol: params.pieceSymbol.trim().slice(0, 4) || '♞',
      totalPoints: startPoints,
      eventsCount: hasStartPoints ? 1 : 0,
      active: true,
      aiEnabled: Boolean(params.aiEnabled),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'students_private', studentId), {
      studentId,
      notes: params.notes.trim().slice(0, 500),
      authKey,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'student_auth', authKey), {
      studentId,
      username: cleanUsername,
      active: true,
      updatedAt: serverTimestamp(),
    });
    if (hasStartPoints) {
      const eventId = generateDocId('pts');
      batch.set(doc(db, 'point_events', eventId), {
        studentId,
        studentName: cleanName,
        groupName: params.groupName.trim().slice(0, 60) || 'Начинающие',
        delta: startPoints,
        category: 'Бонус тренера',
        reason: 'Стартовые баллы при создании аккаунта',
        eventDate: params.todayIso,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `students/${studentId}`);
  }
}

export async function updateStudentStatusOrAi(
  student: AdminStudent,
  patch: { active?: boolean; aiEnabled?: boolean }
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof patch.active === 'boolean') updatePayload.active = patch.active;
    if (typeof patch.aiEnabled === 'boolean') updatePayload.aiEnabled = patch.aiEnabled;

    batch.update(doc(db, 'students', student.id), updatePayload);
    if (typeof patch.active === 'boolean' && student.authKey) {
      batch.update(doc(db, 'student_auth', student.authKey), {
        active: patch.active,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `students/${student.id}`);
  }
}

export async function bulkUpdateStudentsAi(
  students: AdminStudent[],
  aiEnabled: boolean
): Promise<void> {
  if (students.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const s of students) {
      batch.update(doc(db, 'students', s.id), {
        aiEnabled,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'students');
  }
}

export async function resetStudentPassword(
  student: AdminStudent,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 4) {
    throw new Error('Пароль должен содержать минимум 4 символа');
  }
  const newAuthKey = await computeStudentAuthKey(student.username, newPassword);
  try {
    const batch = writeBatch(db);
    if (student.authKey && student.authKey !== newAuthKey) {
      batch.delete(doc(db, 'student_auth', student.authKey));
    }
    batch.set(doc(db, 'student_auth', newAuthKey), {
      studentId: student.id,
      username: student.username,
      active: student.active,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'students_private', student.id), {
      authKey: newAuthKey,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students_private/${student.id}`);
  }
}

export async function deleteStudentAccount(student: AdminStudent): Promise<void> {
  try {
    const eventsSnap = await getDocs(
      query(collection(db, 'point_events'), where('studentId', '==', student.id))
    );
    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', student.id));
    batch.delete(doc(db, 'students_private', student.id));
    if (student.authKey) {
      batch.delete(doc(db, 'student_auth', student.authKey));
      batch.delete(doc(db, 'student_ai_chats', student.authKey));
    }
    for (const evDoc of eventsSnap.docs) {
      batch.delete(evDoc.ref);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${student.id}`);
  }
}

export async function awardPointsToStudents(params: {
  students: AdminStudent[];
  selectedIds: string[];
  delta: number;
  category: string;
  reason: string;
  eventDate: string;
}): Promise<void> {
  const byId = new Map(params.students.map((s) => [s.id, s]));
  const targets = params.selectedIds
    .map((id) => byId.get(id))
    .filter((s): s is AdminStudent => Boolean(s));

  if (targets.length === 0) throw new Error('Отметьте хотя бы одного ученика');
  const cleanDelta = Math.trunc(params.delta);
  if (!Number.isFinite(cleanDelta) || cleanDelta === 0) {
    throw new Error('Укажите ненулевое количество баллов');
  }
  const cleanReason = params.reason.trim().slice(0, 200);
  if (!cleanReason) throw new Error('Укажите причину начисления баллов');

  try {
    const batch = writeBatch(db);
    for (const s of targets) {
      const eventId = generateDocId('pts');
      batch.set(doc(db, 'point_events', eventId), {
        studentId: s.id,
        studentName: s.fullName,
        groupName: s.groupName,
        delta: cleanDelta,
        category: params.category.trim().slice(0, 60) || 'Занятие',
        reason: cleanReason,
        eventDate: params.eventDate,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, 'students', s.id), {
        totalPoints: s.totalPoints + cleanDelta,
        eventsCount: s.eventsCount + 1,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'point_events');
  }
}

export async function deletePointEvent(
  event: PublicPointEvent,
  student: AdminStudent | undefined
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'point_events', event.id));
    if (student) {
      batch.update(doc(db, 'students', student.id), {
        totalPoints: student.totalPoints - event.delta,
        eventsCount: Math.max(0, student.eventsCount - 1),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `point_events/${event.id}`);
  }
}

export async function createNewsItem(params: {
  title: string;
  body: string;
  file: {
    name: string;
    size: number;
    mimeType: string;
    dataBase64: string;
  } | null;
}): Promise<void> {
  const cleanTitle = params.title.trim().slice(0, 180);
  const cleanBody = params.body.trim().slice(0, 1500);
  if (cleanTitle.length < 2) throw new Error('Заголовок новости должен содержать минимум 2 символа');

  if (params.file && params.file.size > MAX_NEWS_FILE_BYTES) {
    throw new Error('Файл слишком большой для облачного хранения. Максимум — 650 КБ.');
  }

  const newsId = generateDocId('news');
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'news', newsId), {
      title: cleanTitle,
      body: cleanBody,
      fileName: params.file ? params.file.name.slice(0, 180) : '',
      fileSize: params.file ? Math.trunc(params.file.size) : 0,
      fileMime: params.file ? params.file.mimeType.slice(0, 120) : '',
      hasFile: Boolean(params.file),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (params.file) {
      batch.set(doc(db, 'news_files', newsId), {
        newsId,
        fileName: params.file.name.slice(0, 180),
        fileMime: params.file.mimeType.slice(0, 120) || 'application/octet-stream',
        fileSize: Math.trunc(params.file.size),
        dataBase64: params.file.dataBase64,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `news/${newsId}`);
  }
}

export async function toggleNewsItemActive(item: NewsItem): Promise<void> {
  const path = `news/${item.id}`;
  try {
    await updateDoc(doc(db, 'news', item.id), {
      active: !item.active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteNewsItem(newsId: string): Promise<void> {
  const path = `news/${newsId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'news', newsId));
    batch.delete(doc(db, 'news_files', newsId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateInboxItem(
  msg: InboxMessage,
  patch: { status?: InboxMessageStatus; adminNote?: string }
): Promise<void> {
  if (msg.kind === 'idea') {
    try {
      const batch = writeBatch(db);
      if (patch.status) {
        batch.update(doc(db, 'ideas', msg.id), {
          status: patch.status,
          updatedAt: serverTimestamp(),
        });
      }
      if (patch.adminNote !== undefined) {
        batch.set(doc(db, 'ideas_admin', msg.id), {
          ideaId: msg.id,
          adminNote: patch.adminNote.trim().slice(0, 500),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ideas/${msg.id}`);
    }
  } else {
    const nextStatus =
      patch.status && patch.status !== 'accepted' ? patch.status : msg.status === 'accepted' ? 'in_progress' : msg.status;
    try {
      const updatePayload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (patch.status) updatePayload.status = nextStatus;
      if (patch.adminNote !== undefined) {
        updatePayload.adminNote = patch.adminNote.trim().slice(0, 500);
      }
      await updateDoc(doc(db, 'support_messages', msg.id), updatePayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `support_messages/${msg.id}`);
    }
  }
}

export async function deleteInboxItem(msg: InboxMessage): Promise<void> {
  if (msg.kind === 'idea') {
    try {
      const votesSnap = await getDocs(
        query(collection(db, 'idea_votes'), where('ideaId', '==', msg.id))
      );
      const batch = writeBatch(db);
      batch.delete(doc(db, 'ideas', msg.id));
      batch.delete(doc(db, 'ideas_admin', msg.id));
      batch.delete(doc(db, 'student_proofs', `idea_${msg.id}`));
      for (const vDoc of votesSnap.docs) {
        batch.delete(vDoc.ref);
        batch.delete(doc(db, 'student_proofs', `vote_${vDoc.id}`));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ideas/${msg.id}`);
    }
  } else {
    try {
      await deleteDoc(doc(db, 'support_messages', msg.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `support_messages/${msg.id}`);
    }
  }
}
