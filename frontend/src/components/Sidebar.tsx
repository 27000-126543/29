import { NavLink } from 'react-router-dom';

const menuItems = [
  { path: '/', label: '钓鱼', icon: '🎣' },
  { path: '/market', label: '市场', icon: '🛒' },
  { path: '/cooking', label: '烹饪', icon: '🍳' },
  { path: '/guild', label: '公会', icon: '👥' },
  { path: '/tournament', label: '大赛', icon: '🏆' },
  { path: '/leaderboard', label: '排行榜', icon: '📊' },
  { path: '/report', label: '周报', icon: '📄' },
];

export default function Sidebar() {
  return (
    <aside className="w-20 lg:w-56 h-screen bg-primary border-r border-accent/20 flex flex-col">
      <div className="p-4 border-b border-accent/20">
        <h1 className="hidden lg:block text-xl font-display text-accent font-bold">钓鱼帝国</h1>
        <span className="lg:hidden text-2xl">🎣</span>
      </div>
      <nav className="flex-1 py-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-accent/20 text-accent border-l-4 border-accent'
                  : 'text-gray-300 hover:bg-accent/10 hover:text-accent border-l-4 border-transparent'
              }`
            }
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="hidden lg:block font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
