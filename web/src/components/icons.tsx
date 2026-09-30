import type { DestinationKind, RuleId } from '@dialplan/shared';
import { CalendarDays, Clock, Crown, Moon, PhoneForwarded, User, Users, Voicemail, type LucideIcon } from 'lucide-react';

export const RULE_ICONS: Record<RuleId, LucideIcon> = {
  vip: Crown,
  holidays: CalendarDays,
  hours: Clock,
  afterHours: Moon,
};

export const DESTINATION_ICONS: Record<DestinationKind, LucideIcon> = {
  ring_group: Users,
  extension: User,
  voicemail: Voicemail,
  external: PhoneForwarded,
};
