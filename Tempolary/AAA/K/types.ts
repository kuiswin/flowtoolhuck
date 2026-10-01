export type BlockType = 
  | 'SCENE_HEADING' 
  | 'ACTION' 
  | 'CHARACTER' 
  | 'DIALOGUE' 
  | 'PARENTHETICAL' 
  | 'TRANSITION';

export type Theme = 'dark' | 'light' | 'sepia';

export interface ScriptBlock {
  id: string;
  type: BlockType;
  content: string;
}

export interface TitlePage {
  show: boolean;
  title: string;
  author: string;
  date: string;
  coverImage?: string; // Optional cover image for the title page
}

export interface AppState {
  blocks: ScriptBlock[];
  characters: string[];
  environments: string[];
  theme: Theme;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundBlur?: number;
  titlePage: TitlePage;
}