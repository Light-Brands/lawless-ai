import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ServiceStatus {
  claude: 'connected' | 'disconnected' | 'error';
  github: 'connected' | 'disconnected' | 'error';
  supabase: 'connected' | 'disconnected' | 'error';
  vercel: 'connected' | 'disconnected' | 'error';
}

interface SelectedElement {
  tagName: string;
  componentName?: string;
  filePath?: string;
  lineNumber?: number;
  innerHTML?: string;
}

interface IDEStore {
  // Drawer state
  isDrawerExpanded: boolean;
  drawerHeight: number;
  setDrawerExpanded: (expanded: boolean) => void;
  setDrawerHeight: (height: number) => void;

  // Messages
  messages: Message[];
  addMessage: (message: Omit<Message, 'timestamp'>) => void;
  clearMessages: () => void;

  // Selected element
  selectedElement: SelectedElement | null;
  setSelectedElement: (element: SelectedElement | null) => void;

  // Service status
  serviceStatus: ServiceStatus;
  setServiceStatus: (service: keyof ServiceStatus, status: ServiceStatus[keyof ServiceStatus]) => void;

  // Inspector mode
  isInspectorActive: boolean;
  setInspectorActive: (active: boolean) => void;
}

export const useIDEStore = create<IDEStore>()(
  persist(
    (set) => ({
      // Drawer state
      isDrawerExpanded: false,
      drawerHeight: 300,
      setDrawerExpanded: (expanded) => set({ isDrawerExpanded: expanded }),
      setDrawerHeight: (height) => set({ drawerHeight: height }),

      // Messages
      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, { ...message, timestamp: new Date() }],
        })),
      clearMessages: () => set({ messages: [] }),

      // Selected element
      selectedElement: null,
      setSelectedElement: (element) => set({ selectedElement: element }),

      // Service status
      serviceStatus: {
        claude: 'disconnected',
        github: 'disconnected',
        supabase: 'disconnected',
        vercel: 'disconnected',
      },
      setServiceStatus: (service, status) =>
        set((state) => ({
          serviceStatus: { ...state.serviceStatus, [service]: status },
        })),

      // Inspector mode
      isInspectorActive: true,
      setInspectorActive: (active) => set({ isInspectorActive: active }),
    }),
    {
      name: 'lawless-ide-store',
      partialize: (state) => ({
        drawerHeight: state.drawerHeight,
        isInspectorActive: state.isInspectorActive,
      }),
    }
  )
);
