\set ON_ERROR_STOP on

\if :{?chat_role}
\else
  \echo 'chat_role is required.'
  \quit 3
\endif

\if :{?chat_password}
\else
  \echo 'chat_password is required.'
  \quit 3
\endif

-- Run after the migration service succeeds. The migration role remains the
-- sole schema-owning application path. The psql password variable is never
-- echoed by this script.
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'chat_role',
  :'chat_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'chat_role')
\gexec

SELECT format(
  'ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
  :'chat_role',
  :'chat_password'
)
\gexec

SELECT format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM %I', current_database(), :'chat_role')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'chat_role')
\gexec
REVOKE ALL PRIVILEGES ON SCHEMA public FROM :"chat_role";
GRANT USAGE ON SCHEMA public TO :"chat_role";
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM :"chat_role";
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM :"chat_role";

-- Account authorization: no email, password, token, or AI columns.
GRANT SELECT ("id", "authVersion", "disabledAt", "emailVerified", "plan", "role")
  ON TABLE public."User" TO :"chat_role";
GRANT SELECT ("id", "userId", "revokedAt")
  ON TABLE public."ChatBetaAccess" TO :"chat_role";
GRANT SELECT ("userId", "policyVersion")
  ON TABLE public."ChatPolicyAcceptance" TO :"chat_role";
GRANT SELECT ("id", "userId", "handle", "handleNormalized")
  ON TABLE public."ChatProfile" TO :"chat_role";

-- Gateway snapshot and normal-message path. Moderation, reports, retention,
-- and bot actions remain in the web/worker roles until separately reviewed.
GRANT SELECT ("blockerUserId", "blockedUserId")
  ON TABLE public."ChatBlock" TO :"chat_role";
GRANT SELECT ("id", "slug", "name", "description", "topicLine", "languageCode", "visibility", "joinPolicy", "historyVisibility", "state", "isOfficial", "slowModeSeconds", "lastActivityAt")
  ON TABLE public."ChatRoom" TO :"chat_role";
GRANT UPDATE ("lastActivityAt", "updatedAt")
  ON TABLE public."ChatRoom" TO :"chat_role";
GRANT SELECT ("roomId", "interestId")
  ON TABLE public."ChatRoomInterest" TO :"chat_role";
GRANT SELECT ("id", "roomId", "userId", "role", "status", "joinedAt", "lastReadMessageSequence", "nextMessageAllowedAt", "roomMutedUntil")
  ON TABLE public."ChatRoomMember" TO :"chat_role";
GRANT UPDATE ("lastReadMessageSequence", "nextMessageAllowedAt", "updatedAt")
  ON TABLE public."ChatRoomMember" TO :"chat_role";
GRANT SELECT ("id", "sequence", "roomId", "senderUserId", "clientMessageId", "kind", "body", "articleId", "createdAt", "deletedAt")
  ON TABLE public."ChatMessage" TO :"chat_role";
GRANT INSERT ("id", "version", "roomId", "senderUserId", "clientMessageId", "kind", "body", "metadata", "createdAt")
  ON TABLE public."ChatMessage" TO :"chat_role";
GRANT USAGE, SELECT ON SEQUENCE public."ChatMessage_sequence_seq" TO :"chat_role";
GRANT SELECT ("id") ON TABLE public."ChatEventOutbox" TO :"chat_role";
GRANT INSERT ("id", "version", "eventType", "aggregateType", "aggregateId", "payload", "createdAt", "availableAt", "attemptCount")
  ON TABLE public."ChatEventOutbox" TO :"chat_role";

-- Article shares created by the web may appear in a socket snapshot. The
-- gateway can display the title and publisher only; it cannot read content.
GRANT SELECT ("id", "feedId", "title") ON TABLE public."Article" TO :"chat_role";
GRANT SELECT ("id", "title") ON TABLE public."Feed" TO :"chat_role";
