import { auth } from './firebase';
import { fetchFunctionJson } from './serverFunctions';

export type InternalGuideId = 'master-admin' | 'dealer';

export interface InternalGuideStep {
  title: string;
  body: string;
  bullets?: string[];
  result?: string;
  warning?: string;
  links?: InternalGuideLink[];
}

export interface InternalGuideLink {
  label: string;
  to: string;
  note: string;
}

export interface InternalGuideSection {
  id: string;
  title: string;
  summary: string;
  icon: string;
  steps: InternalGuideStep[];
  checklist?: string[];
  links?: InternalGuideLink[];
}

export interface InternalGuideContent {
  id: InternalGuideId;
  title: string;
  eyebrow: string;
  subtitle: string;
  sections: InternalGuideSection[];
  quickLinks: InternalGuideLink[];
}

interface InternalGuideContentResponse {
  ok: true;
  guide: InternalGuideContent;
}

const getRequiredIdToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to open this guide.');
  }

  return currentUser.getIdToken();
};

export const fetchInternalGuideContent = async (guideId: InternalGuideId) => {
  const idToken = await getRequiredIdToken();
  const response = await fetchFunctionJson<InternalGuideContentResponse, { guideId: InternalGuideId }>(
    'internal-guide-content',
    {
      method: 'POST',
      body: { guideId },
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
  );

  return response.guide;
};
