
export const formatDate = (value: any): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  // Handle Firebase Timestamp
  if (typeof value === 'object' && 'seconds' in value) {
    try {
      return new Date(value.seconds * 1000).toLocaleDateString();
    } catch (error) {
      console.error('Failed to format timestamp', error);
      return null;
    }
  }
  
  // Handle objects with toDate() (Firestore SDK objects)
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      return value.toDate().toLocaleDateString();
    } catch (error) {
       console.error('Failed to format timestamp', error);
       return null;
    }
  }

  return null;
};
