import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, X, FileText, ExternalLink, Building2, Briefcase } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { formatIranPhone, toPersianDigits } from '../../lib/iran-format';
import { navigateWithAppPrefix } from '../../lib/url';

export interface IncomingCallData {
  callerName?: string;
  callerPhone: string;
  companyName?: string;
  openDealsCount?: number;
  contactId?: string;
  dealId?: string;
}

export const VoipCallToast: React.FC = () => {
  const [call, setCall] = useState<IncomingCallData | null>(null);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleIncomingCall: EventListener = (evt) => {
      const customEvt = evt as CustomEvent<IncomingCallData>;
      if (customEvt.detail) {
        setCall(customEvt.detail);
        setShowQuickNote(false);
        setNoteText('');
        setSavedSuccess(false);
        setNoteError(null);
      }
    };

    window.addEventListener('bidar:incoming_call', handleIncomingCall);
    return () => {
      window.removeEventListener('bidar:incoming_call', handleIncomingCall);
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  if (!call) return null;

  const handleDismiss = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setCall(null);
    setShowQuickNote(false);
    setNoteText('');
    setNoteError(null);
  };

  const handleNavigate = () => {
    let target = '/activities';
    if (call.dealId) {
      target = `/deals/${call.dealId}`;
    } else if (call.contactId) {
      target = `/contacts?id=${call.contactId}`;
    }
    navigateWithAppPrefix(target);
    handleDismiss();
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setIsSavingNote(true);
    setNoteError(null);
    try {
      const parentType = call.dealId ? 'Opportunity' : call.contactId ? 'Contact' : undefined;
      const parentId = call.dealId || call.contactId;

      if (parentType && parentId) {
        await apiClient.post('/Note', {
          post: noteText.trim(),
          type: 'Post',
          parentType,
          parentId,
        });
      } else {
        await apiClient.post('/Call', {
          name: `تماس ورودی ${call.callerPhone}`,
          description: noteText.trim(),
          status: 'Held',
          direction: 'Inbound',
        });
      }

      setSavedSuccess(true);
      dismissTimerRef.current = window.setTimeout(() => {
        handleDismiss();
      }, 1200);
    } catch (err: unknown) {
      setSavedSuccess(false);
      setNoteError(err instanceof Error ? err.message : 'خطا در ثبت یادداشت تماس');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div
      role="alert"
      aria-label="تماس تلفنی دریافتی"
      className="fixed bottom-5 left-5 z-50 w-80 max-w-sm bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl p-4 transition-all duration-300"
      style={{ direction: 'rtl' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-pulse">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                تماس ورودی VoIP
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {call.callerName || 'مخاطب ناشناس'}
            </h4>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
          title="بستن"
          aria-label="بستن اعلان تماس"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            شماره:
          </span>
          <span className="font-vazirmatn tabular-nums text-slate-800 dark:text-slate-100 font-medium" dir="ltr">
            {formatIranPhone(call.callerPhone)}
          </span>
        </div>

        {call.companyName && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              شرکت:
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {call.companyName}
            </span>
          </div>
        )}

        {call.openDealsCount !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              معاملات جاری:
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {toPersianDigits(call.openDealsCount)} معامله
            </span>
          </div>
        )}
      </div>

      {showQuickNote ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="یادداشت تماس را بنویسید..."
            rows={2}
            className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          {noteError && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">{noteError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowQuickNote(false)}
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              انصراف
            </button>
            <button
              onClick={handleSaveNote}
              disabled={isSavingNote || !noteText.trim()}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
            >
              {isSavingNote ? 'در حال ثبت...' : savedSuccess ? '✓ ثبت شد' : 'ثبت یادداشت'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleNavigate}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            مشاهده پرونده
          </button>
          <button
            onClick={() => setShowQuickNote(true)}
            className="flex items-center justify-center gap-1 py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            ثبت سریع یادداشت
          </button>
        </div>
      )}
    </div>
  );
};
