export type Mood = 'h' | 'w' | 'n';
export type ArtType = 'stamp' | 'leaf' | 'pattern' | 'sticker' | 'flower' | 'cat' | 'paper';
export type ArtList = 'stamps' | 'leaves' | 'patterns' | 'stickers' | 'flowers' | 'cats' | 'papers';

export interface Asset { id: string; file: string; w: number; h: number; kind?: string; corner_at?: string }
export interface FolderSkin {
  id: string; file: string; avg: string; w: number; h: number; dark: boolean;
  geo: { bx: number; by: number; bw: number; bh: number; tabL: number; tabR: number; tabH: number };
}
export type ArtIndex = Record<ArtList, Record<string, Asset>>;

export interface Card {
  id: string; kind: 'photo' | 'camera' | 'album'; imageId: string; w: number; h: number;
  caption?: string; album?: { title: string; artist: string };
}

export type FrameId = 'polaroid' | 'instax' | 'film' | 'kraft' | 'round' | 'torn';
interface Box { id: string; x: number; y: number; w: number; h: number; rot: number; z: number; d: number; picked?: boolean }
export type PhotoItem = Box & { type: 'photo'; cardId: string; frame: FrameId; torn: string };
export type NoteItem = Box & { type: 'note'; text: string; sig: string; kind: NoteKind; fs: number; lh: number; torn: string };
export type TitleItem = Box & { type: 'title'; text: string; chip: string; tfs: number };
export type QuoteItem = Box & { type: 'quote'; text: string; qfs: number };
export type ArtItem = Box & { type: ArtType; art: string };
export type TapeItem = Box & { type: 'tape'; kind: string };
export type ScrapItem = Box & { type: 'scrap'; text: string; mono?: boolean };
export type Item = PhotoItem | NoteItem | TitleItem | QuoteItem | ArtItem | TapeItem | ScrapItem;

export type Arc = 'heavy-warm' | 'warm-heavy' | 'mixed' | 'warm' | 'heavy';
export type Phase = 'early' | 'late' | 'any';
export type NoteKind = 'kraft' | 'white' | 'slate';
export interface Phased { id: string; phase: Phase }

export interface ArtDirection {
  seed: number;
  mood: { arc: Arc; summary: string; chips: string[]; neg: number; pos: number };
  palette: { ink: string; accent: string; tape: string; paperKind: 'grid' | 'lined' | 'dots'; noteKind: NoteKind; filter: string };
  title: string;
  dateChip: string;
  dateShort: string;
  quote: string;
  scraps: string[];
  stickers: {
    stamps: Phased[]; leaves: Phased[]; flowers: Phased[];
    patterns: { id: string; m?: Mood; s: number }[]; patternCount: number;
    cat?: string; papers: { under: string; quote: string };
    clip?: string; pin?: string; extra?: string | null;
  };
  themes: string[];
  density: 'sparse' | 'medium' | 'rich';
}

export interface DirectorInput { story: string; start: string; end: string; cardCount: number }
export interface Director { direct(input: DirectorInput): Promise<ArtDirection> }

export interface Folder { id: string; name: string; skin: string; createdAt: number }
export interface Page {
  id: string; folderId: string; start: string; end: string; story: string;
  cards: Card[]; direction: ArtDirection; items: Item[]; createdAt: number; updatedAt: number;
}
