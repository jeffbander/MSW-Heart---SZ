'use client';

import MainCalendar from './components/MainCalendar';
import { useAdmin } from './contexts/AdminContext';

export default function Home() {
  const { isAdminMode } = useAdmin();

  return <MainCalendar isAdmin={isAdminMode} />;
}
