import { formatTimestamp, type StaffNotification } from '../types';

interface NotificationsViewProps {
  items: StaffNotification[];
  loading: boolean;
}

export function NotificationsView({ items, loading }: NotificationsViewProps) {
  return (
    <section aria-labelledby="notif-heading">
      <h1 id="notif-heading" className="font-serif text-3xl mb-1 text-balance">
        Notifications
      </h1>
      <p className="text-ink/70 mb-6 max-w-2xl">
        Updates for incoming document requests and office activity.
      </p>

      {loading ? (
        <div className="bg-white border border-ink/15 rounded-md p-5 text-sm text-ink/70">
          Loading notifications...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-ink/15 rounded-md p-5 text-sm text-ink/60">
          No notifications yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.notificationId}
              className={`bg-white border rounded-md p-4 ${
                item.read ? 'border-ink/15' : 'border-gold ring-1 ring-gold/40'
              }`}
            >
              <div className="font-medium">{item.message}</div>
              <div className="text-xs text-ink/60 mt-1 tabular-nums">
                {formatTimestamp(item.createdAt)} &middot; {item.via}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
