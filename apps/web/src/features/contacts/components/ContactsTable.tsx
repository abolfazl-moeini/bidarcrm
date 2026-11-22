/**
 * BidarCRM - ContactsTable Component
 *
 * Renders an accessible, searchable, and responsive table of contacts/people.
 * Employs clean Slate/Indigo styling with direct communication links (tel:, mailto:).
 */

import React, { useMemo } from 'react';
import { User, Building2, Phone, Mail, Calendar, Search, X } from 'lucide-react';
import { Contact } from '../../../types/espocrm';
import { formatJalaliDate } from '../../../lib/jalali';
import { toPersianDigits } from '../../../lib/currency';

export interface ContactsTableProps {
  contacts: Contact[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
  onSelectContact?: (contactId: string) => void;
  className?: string;
}

export const ContactsTable: React.FC<ContactsTableProps> = ({
  contacts,
  searchQuery = '',
  onSearchChange,
  isLoading = false,
  onSelectContact,
  className = '',
}) => {
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      const name = c.name?.toLowerCase() || `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
      const phone = c.phoneNumber?.toLowerCase() || '';
      const email = c.emailAddress?.toLowerCase() || '';
      const account = c.accountName?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || email.includes(q) || account.includes(q);
    });
  }, [contacts, searchQuery]);

  return (
    <div className={`space-y-4 ${className}`} dir="rtl">
      {/* Search Input Bar (if handler provided) */}
      {onSearchChange && (
        <div className="relative max-w-md">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="جستجو در مخاطبان (نام، شرکت، تلفن، ایمیل)..."
            className="w-full pr-9 pl-8 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 transition outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-0.5 cursor-pointer"
              title="پاک کردن جستجو"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="bidar-contacts-table w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-xs font-semibold select-none">
                <th className="py-3.5 px-4">نام و نام خانوادگی</th>
                <th className="py-3.5 px-4">شرکت مرتبط</th>
                <th className="py-3.5 px-4">شماره تماس</th>
                <th className="py-3.5 px-4">ایمیل</th>
                <th className="py-3.5 px-4">تاریخ ثبت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
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
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-indigo-500/20 transition">
                          {displayName.charAt(0) || <User className="w-4 h-4" />}
                        </div>
                        <span className="font-semibold text-slate-100 group-hover:text-indigo-300 transition">
                          {displayName}
                        </span>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {contact.accountName ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{contact.accountName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Phone with tel: */}
                    <td className="py-3.5 px-4">
                      {contact.phoneNumber ? (
                        <a
                          href={`tel:${contact.phoneNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 font-mono transition"
                          dir="ltr"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-500/70" />
                          <span>{contact.phoneNumber}</span>
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Email with mailto: */}
                    <td className="py-3.5 px-4">
                      {contact.emailAddress ? (
                        <a
                          href={`mailto:${contact.emailAddress}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-slate-300 hover:text-indigo-400 font-mono transition truncate max-w-[200px]"
                          dir="ltr"
                        >
                          <Mail className="w-3.5 h-3.5 text-indigo-400/70 flex-shrink-0" />
                          <span className="truncate">{contact.emailAddress}</span>
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Creation Date */}
                    <td className="py-3.5 px-4 text-slate-400">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]" dir="ltr">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{jalaliDate}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredContacts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                    مخاطبی با مشخصات مورد نظر یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            تعداد کل مخاطبان:{' '}
            <strong className="text-slate-200 font-medium">
              {toPersianDigits(filteredContacts.length)}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ContactsTable;
