/**
 * BidarCRM - ContactsTable Component
 *
 * Renders an accessible, searchable, and responsive table of contacts/people.
 * Employs Didar-inspired clean data grid styling, light/dark mode adaptation,
 * direct communication links (tel:, mailto:), customer group chips (GAP-05),
 * Iranian fields (nationalCode), and quick SMS dispatch action.
 */

import React, { useMemo } from 'react';
import {
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  Search,
  X,
  MessageSquare,
} from 'lucide-react';
import { Contact } from '../../../types/espocrm';
import { formatJalaliDate } from '../../../lib/jalali';
import { toPersianDigits, formatIranPhone } from '../../../lib/iran-format';

export interface ContactsTableProps {
  contacts: (Contact & { customerGroups?: string[]; nationalCode?: string })[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedGroup?: string;
  isLoading?: boolean;
  onSelectContact?: (contactId: string) => void;
  onSendSms?: (contact: Contact) => void;
  className?: string;
}

const GROUP_LABELS: Record<string, string> = {
  VIP: 'ویژه (VIP)',
  Reseller: 'نماینده',
  Loyal: 'وفادار',
  Exhibition: 'نمایشگاهی',
  FirstPurchase: 'خرید اول',
};

export const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  searchQuery = '',
  onSearchChange,
  selectedGroup = '',
  isLoading = false,
  onSelectContact,
  onSendSms,
  className = '',
}) => {
  const filteredContacts = useMemo(() => {
    let list = contacts;

    // Filter by customerGroup if set
    if (selectedGroup) {
      list = list.filter((c) => c.customerGroups?.includes(selectedGroup));
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((c) => {
      const name = c.name?.toLowerCase() || `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const phone = c.phoneNumber?.toLowerCase() || '';
      const email = c.emailAddress?.toLowerCase() || '';
      const account = c.accountName?.toLowerCase() || '';
      const natCode = c.nationalCode || '';
      return (
        name.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        account.includes(q) ||
        natCode.includes(q)
      );
    });
  }, [contacts, searchQuery, selectedGroup]);

  return (
    <div className={`space-y-4 ${className}`} dir="rtl">
      {/* Search Input Bar (if handler provided) */}
      {onSearchChange && (
        <div className="relative max-w-md">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="جستجو در مخاطبان (نام، شرکت، تلفن، ایمیل، کد ملی)..."
            className="w-full pr-9 pl-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 transition outline-none shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5 cursor-pointer"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="bidar-contacts-table w-full text-right border-collapse font-vazirmatn">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold select-none">
                <th className="py-3 px-4 font-vazirmatn">نام و نام خانوادگی</th>
                <th className="py-3 px-4 font-vazirmatn">شرکت مرتبط</th>
                <th className="py-3 px-4 font-vazirmatn">گروه‌بندی</th>
                <th className="py-3 px-4 font-vazirmatn">شماره تماس</th>
                <th className="py-3 px-4 font-vazirmatn">ایمیل</th>
                <th className="py-3 px-4 font-vazirmatn">کد ملی</th>
                <th className="py-3 px-4 font-vazirmatn">تاریخ ثبت</th>
                <th className="py-3 px-4 text-center font-vazirmatn">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-800 dark:text-slate-200">
              {filteredContacts.map((contact) => {
                const displayName =
                  contact.name ||
                  `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                  'بدون نام';

                const jalaliDate = contact.createdAt ? formatJalaliDate(contact.createdAt) : '—';

                return (
                  <tr
                    key={contact.id}
                    onClick={() => onSelectContact?.(contact.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-emerald-500/20 transition">
                          {displayName.charAt(0) || <User className="w-4 h-4" />}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          {displayName}
                        </span>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {contact.accountName ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                          <span className="truncate font-medium">{contact.accountName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Customer Groups Tags */}
                    <td className="py-3.5 px-4">
                      {contact.customerGroups && contact.customerGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.customerGroups.map((g) => (
                            <span
                              key={g}
                              className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap inline-flex items-center shrink-0"
                            >
                              {GROUP_LABELS[g] || g}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Phone with tel: */}
                    <td className="py-3.5 px-4">
                      {contact.phoneNumber ? (
                        <a
                          href={`tel:${contact.phoneNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-sans tabular-nums transition"
                          dir="ltr"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-500/70" />
                          <span>{formatIranPhone(contact.phoneNumber)}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Email with mailto: */}
                    <td className="py-3.5 px-4">
                      {contact.emailAddress ? (
                        <a
                          href={`mailto:${contact.emailAddress}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-sans tabular-nums transition truncate max-w-[180px]"
                          dir="ltr"
                        >
                          <Mail className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-400/70 flex-shrink-0" />
                          <span className="truncate">{contact.emailAddress}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Iranian National Code */}
                    <td className="py-3.5 px-4 font-sans tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                      {contact.nationalCode ? toPersianDigits(contact.nationalCode) : '—'}
                    </td>

                    {/* Creation Date */}
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-sans tabular-nums text-[11px]" dir="ltr">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{jalaliDate}</span>
                      </div>
                    </td>

                    {/* Actions: Send SMS */}
                    <td className="py-3.5 px-4 text-center">
                      {contact.phoneNumber && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendSms?.(contact);
                          }}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition cursor-pointer"
                          title="ارسال پیامک مستقیم"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredContacts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                    مخاطبی با مشخصات مورد نظر یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            تعداد کل مخاطبان:{' '}
            <strong className="text-slate-800 dark:text-slate-200 font-semibold">
              {toPersianDigits(filteredContacts.length)}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ContactsTable;
