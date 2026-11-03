import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "subtle";
}

const MenuButton = ({ icon: Icon, label, onClick, variant = "default" }: MenuButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center gap-4 w-full px-5 py-4 rounded-lg transition-all duration-300",
        "border border-border/40 hover:border-primary/60",
        "hover:glow-primary active:scale-[0.97]",
        variant === "primary" && "bg-primary/10 border-primary/40 glow-primary",
        variant === "default" && "bg-card/40 hover:bg-card/70",
        variant === "subtle" && "bg-transparent border-transparent hover:bg-card/30 hover:border-border/30",
      )}
    >
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-md transition-all duration-300",
        "bg-primary/10 group-hover:bg-primary/20",
        variant === "primary" && "bg-primary/20",
      )}>
        <Icon className="w-5 h-5 text-primary transition-all duration-300 group-hover:drop-shadow-[0_0_6px_hsl(185_70%_50%/0.6)]" />
      </div>
      <span className={cn(
        "font-sansserief text-sm tracking-wider uppercase text-foreground/80 group-hover:text-foreground transition-colors",
        variant === "primary" && "text-primary",
      )}>
        {label}
      </span>
    </button>
  );
};

export default MenuButton;
