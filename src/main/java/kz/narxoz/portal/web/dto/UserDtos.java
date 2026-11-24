package kz.narxoz.portal.web.dto;

import kz.narxoz.portal.domain.Role;
import kz.narxoz.portal.domain.User;

/**
 * FIX (Test 3): the API never returns the User entity any more.
 * Each response contains only the fields that screen really needs:
 * no passwordHash, no IIN.
 */
public final class UserDtos {

    private UserDtos() {
    }

    /** Own profile (and admin user list). */
    public record Profile(Long id, String username, String fullName, String email,
                          String phone, String groupName, Role role) {
        public static Profile from(User u) {
            return new Profile(u.getId(), u.getUsername(), u.getFullName(), u.getEmail(),
                    u.getPhone(), u.getGroupName(), u.getRole());
        }
    }

    /** Contact card a teacher sees for a student. */
    public record Contact(Long id, String fullName, String email, String groupName) {
        public static Contact from(User u) {
            return new Contact(u.getId(), u.getFullName(), u.getEmail(), u.getGroupName());
        }
    }
}
