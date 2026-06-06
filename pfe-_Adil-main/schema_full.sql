--
-- PostgreSQL database dump
--

\restrict FVVQ3LG3TH2PrrXHLc9FXfSV0p6yCQ3YzWCwbKa9moUJg2Zk2vMiD7LmToMfSzv

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: action_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.action_type AS ENUM (
    'COMPLETE_RESOURCE',
    'COMPLETE_MODULE',
    'JOIN_COMMUNITY',
    'POST_COMMUNITY',
    'DAILY_LOGIN'
);


ALTER TYPE public.action_type OWNER TO postgres;

--
-- Name: community_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.community_role AS ENUM (
    'MEMBER',
    'MODERATOR',
    'ADMIN'
);


ALTER TYPE public.community_role OWNER TO postgres;

--
-- Name: niveau_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.niveau_type AS ENUM (
    'L1',
    'L2',
    'L3',
    'M1',
    'M2'
);


ALTER TYPE public.niveau_type OWNER TO postgres;

--
-- Name: progress_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.progress_status AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED'
);


ALTER TYPE public.progress_status OWNER TO postgres;

--
-- Name: resource_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.resource_category AS ENUM (
    'Cours',
    'TD',
    'TP',
    'Examen'
);


ALTER TYPE public.resource_category OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'FORMATEUR',
    'FORMATEUR_SIMPLE',
    'ETUDIANT'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE conversations 
    SET last_message = NEW.content,
        last_message_at = NEW.created_at,
        last_message_by = NEW.user_id,
        updated_at = NEW.created_at,
        message_count = message_count + 1
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_conversation_last_message() OWNER TO postgres;

--
-- Name: update_post_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_post_counts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_TABLE_NAME = 'post_reactions' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'shares' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE posts SET shares_count = shares_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE posts SET shares_count = shares_count - 1 WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_post_counts() OWNER TO postgres;

--
-- Name: update_posts_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_posts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_posts_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.badges (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(100),
    xp_required integer,
    modules_completed_required integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.badges OWNER TO postgres;

--
-- Name: badges_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.badges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.badges_id_seq OWNER TO postgres;

--
-- Name: badges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.badges_id_seq OWNED BY public.badges.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    slug character varying(50) NOT NULL,
    description text,
    icon character varying(100),
    color character varying(20),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: comment_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_reactions (
    id integer NOT NULL,
    comment_id integer NOT NULL,
    user_id integer NOT NULL,
    reaction_type character varying(20) DEFAULT 'LIKE'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.comment_reactions OWNER TO postgres;

--
-- Name: comment_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comment_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comment_reactions_id_seq OWNER TO postgres;

--
-- Name: comment_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comment_reactions_id_seq OWNED BY public.comment_reactions.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    likes_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO postgres;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: communities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communities (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    category_id integer,
    image_url character varying(500),
    banner_url character varying(500),
    member_count integer DEFAULT 0,
    resource_count integer DEFAULT 0,
    post_count integer DEFAULT 0,
    created_by integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.communities OWNER TO postgres;

--
-- Name: communities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.communities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.communities_id_seq OWNER TO postgres;

--
-- Name: communities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.communities_id_seq OWNED BY public.communities.id;


--
-- Name: community_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_members (
    id integer NOT NULL,
    community_id integer NOT NULL,
    user_id integer NOT NULL,
    role public.community_role DEFAULT 'MEMBER'::public.community_role,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_active timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.community_members OWNER TO postgres;

--
-- Name: community_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.community_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.community_members_id_seq OWNER TO postgres;

--
-- Name: community_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.community_members_id_seq OWNED BY public.community_members.id;


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    user_id integer NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_read_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(20) DEFAULT 'MEMBER'::character varying,
    is_muted boolean DEFAULT false,
    left_at timestamp without time zone,
    CONSTRAINT conversation_participants_role_check CHECK (((role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MEMBER'::character varying])::text[])))
);


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- Name: conversation_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversation_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversation_participants_id_seq OWNER TO postgres;

--
-- Name: conversation_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversation_participants_id_seq OWNED BY public.conversation_participants.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    conversation_type character varying(20) NOT NULL,
    group_name character varying(255),
    group_avatar character varying(500),
    level_name character varying(10),
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    last_message text,
    last_message_at timestamp without time zone,
    last_message_by integer,
    message_count integer DEFAULT 0,
    community_id integer,
    is_community_chat boolean DEFAULT false,
    CONSTRAINT conversations_conversation_type_check CHECK (((conversation_type)::text = ANY (ARRAY['PRIVATE'::text, 'GROUP'::text, 'LEVEL'::text, 'COMMUNITY'::text]))),
    CONSTRAINT conversations_level_name_check CHECK (((level_name)::text = ANY ((ARRAY['L1'::character varying, 'L2'::character varying, 'L3'::character varying, 'M1'::character varying, 'M2'::character varying])::text[])))
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: etudiant_module_enrollment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.etudiant_module_enrollment (
    id integer NOT NULL,
    etudiant_id integer NOT NULL,
    module_id integer NOT NULL,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'ACTIVE'::character varying
);


ALTER TABLE public.etudiant_module_enrollment OWNER TO postgres;

--
-- Name: etudiant_module_enrollment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.etudiant_module_enrollment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.etudiant_module_enrollment_id_seq OWNER TO postgres;

--
-- Name: etudiant_module_enrollment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.etudiant_module_enrollment_id_seq OWNED BY public.etudiant_module_enrollment.id;


--
-- Name: formateur_module_assignment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.formateur_module_assignment (
    id integer NOT NULL,
    formateur_id integer NOT NULL,
    module_id integer NOT NULL,
    assigned_by integer,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_primary boolean DEFAULT false
);


ALTER TABLE public.formateur_module_assignment OWNER TO postgres;

--
-- Name: formateur_module_assignment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.formateur_module_assignment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.formateur_module_assignment_id_seq OWNER TO postgres;

--
-- Name: formateur_module_assignment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.formateur_module_assignment_id_seq OWNED BY public.formateur_module_assignment.id;


--
-- Name: message_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_reactions (
    id integer NOT NULL,
    message_id integer NOT NULL,
    user_id integer NOT NULL,
    reaction character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.message_reactions OWNER TO postgres;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.message_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.message_reactions_id_seq OWNER TO postgres;

--
-- Name: message_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.message_reactions_id_seq OWNED BY public.message_reactions.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    message_type character varying(20) DEFAULT 'TEXT'::character varying,
    file_url character varying(500),
    file_name character varying(255),
    file_size integer,
    mime_type character varying(100),
    reply_to_message_id integer,
    is_edited boolean DEFAULT false,
    edited_at timestamp without time zone,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_by jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['TEXT'::character varying, 'FILE'::character varying, 'IMAGE'::character varying, 'SYSTEM'::character varying])::text[])))
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modules (
    id integer NOT NULL,
    code character varying(20) NOT NULL,
    nom character varying(255) NOT NULL,
    description text,
    niveau public.niveau_type NOT NULL,
    credits integer DEFAULT 0,
    coeff numeric(3,2) DEFAULT 1.00,
    components text[] DEFAULT ARRAY['Cours', 'TD', 'TP'],
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    category_id integer,
    xp_reward integer DEFAULT 50,
    display_order integer DEFAULT 0
);


ALTER TABLE public.modules OWNER TO postgres;

--
-- Name: modules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modules_id_seq OWNER TO postgres;

--
-- Name: modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.modules_id_seq OWNED BY public.modules.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    link character varying(500),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.password_reset_tokens_id_seq OWNER TO postgres;

--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: post_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_reactions (
    id integer NOT NULL,
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    reaction_type character varying(20) DEFAULT 'INSIGHTFUL'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT post_reactions_reaction_type_check CHECK (((reaction_type)::text = ANY ((ARRAY['INSIGHTFUL'::character varying, 'HELPFUL'::character varying, 'LIKE'::character varying])::text[])))
);


ALTER TABLE public.post_reactions OWNER TO postgres;

--
-- Name: post_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_reactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_reactions_id_seq OWNER TO postgres;

--
-- Name: post_reactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_reactions_id_seq OWNED BY public.post_reactions.id;


--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    content text NOT NULL,
    image_url character varying(500),
    post_type character varying(20) DEFAULT 'QUESTION'::character varying,
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    shares_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT posts_post_type_check CHECK (((post_type)::text = ANY ((ARRAY['QUESTION'::character varying, 'DISCUSSION'::character varying, 'ANNOUNCEMENT'::character varying, 'RESOURCE'::character varying])::text[])))
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posts_id_seq OWNER TO postgres;

--
-- Name: posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.posts_id_seq OWNED BY public.posts.id;


--
-- Name: ressource_pedagogique; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ressource_pedagogique (
    id integer NOT NULL,
    module_id integer NOT NULL,
    uploaded_by integer NOT NULL,
    titre character varying(255) NOT NULL,
    description text,
    category public.resource_category NOT NULL,
    file_path character varying(500) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size integer,
    file_type character varying(100),
    download_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ressource_pedagogique OWNER TO postgres;

--
-- Name: ressource_pedagogique_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ressource_pedagogique_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ressource_pedagogique_id_seq OWNER TO postgres;

--
-- Name: ressource_pedagogique_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ressource_pedagogique_id_seq OWNED BY public.ressource_pedagogique.id;


--
-- Name: shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shares (
    id integer NOT NULL,
    post_id integer NOT NULL,
    user_id integer NOT NULL,
    shared_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.shares OWNER TO postgres;

--
-- Name: shares_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shares_id_seq OWNER TO postgres;

--
-- Name: shares_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shares_id_seq OWNED BY public.shares.id;


--
-- Name: student_badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_badges (
    id integer NOT NULL,
    student_id integer NOT NULL,
    badge_id integer NOT NULL,
    earned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.student_badges OWNER TO postgres;

--
-- Name: student_badges_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_badges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_badges_id_seq OWNER TO postgres;

--
-- Name: student_badges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_badges_id_seq OWNED BY public.student_badges.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    matricule character varying(20),
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    google_id character varying(255),
    nom character varying(100) NOT NULL,
    prenom character varying(100) NOT NULL,
    role_global public.user_role DEFAULT 'ETUDIANT'::public.user_role NOT NULL,
    niveau public.niveau_type,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen timestamp without time zone,
    is_online boolean DEFAULT false,
    onboarding_completed boolean DEFAULT false,
    total_xp integer DEFAULT 0,
    current_level integer DEFAULT 1
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: student_enrollments_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.student_enrollments_view AS
 SELECT e.id AS enrollment_id,
    e.etudiant_id AS student_id,
    u.email AS student_email,
    u.nom AS student_nom,
    u.prenom AS student_prenom,
    u.niveau AS student_niveau,
    m.id AS module_id,
    m.code AS module_code,
    m.nom AS module_nom,
    m.niveau AS module_niveau,
    e.enrolled_at,
    e.status
   FROM ((public.etudiant_module_enrollment e
     JOIN public.users u ON ((e.etudiant_id = u.id)))
     JOIN public.modules m ON ((e.module_id = m.id)));


ALTER VIEW public.student_enrollments_view OWNER TO postgres;

--
-- Name: student_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_levels (
    id integer NOT NULL,
    student_id integer NOT NULL,
    current_level integer DEFAULT 1,
    total_xp integer DEFAULT 0,
    resources_completed integer DEFAULT 0,
    modules_completed integer DEFAULT 0,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date date
);


ALTER TABLE public.student_levels OWNER TO postgres;

--
-- Name: student_levels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_levels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_levels_id_seq OWNER TO postgres;

--
-- Name: student_levels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_levels_id_seq OWNED BY public.student_levels.id;


--
-- Name: student_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_progress (
    id integer NOT NULL,
    student_id integer NOT NULL,
    module_id integer NOT NULL,
    resource_id integer NOT NULL,
    status public.progress_status DEFAULT 'NOT_STARTED'::public.progress_status,
    progress_percent integer DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    last_accessed timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    time_spent integer DEFAULT 0
);


ALTER TABLE public.student_progress OWNER TO postgres;

--
-- Name: student_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.student_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_progress_id_seq OWNER TO postgres;

--
-- Name: student_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.student_progress_id_seq OWNED BY public.student_progress.id;


--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_presence (
    user_id integer NOT NULL,
    is_online boolean DEFAULT false,
    last_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    current_room character varying(100),
    socket_id character varying(100)
);


ALTER TABLE public.user_presence OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: xp_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xp_rules (
    id integer NOT NULL,
    action_type public.action_type NOT NULL,
    xp_points integer NOT NULL,
    description text,
    is_active boolean DEFAULT true
);


ALTER TABLE public.xp_rules OWNER TO postgres;

--
-- Name: xp_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.xp_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.xp_rules_id_seq OWNER TO postgres;

--
-- Name: xp_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.xp_rules_id_seq OWNED BY public.xp_rules.id;


--
-- Name: badges id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges ALTER COLUMN id SET DEFAULT nextval('public.badges_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: comment_reactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reactions ALTER COLUMN id SET DEFAULT nextval('public.comment_reactions_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: communities id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities ALTER COLUMN id SET DEFAULT nextval('public.communities_id_seq'::regclass);


--
-- Name: community_members id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members ALTER COLUMN id SET DEFAULT nextval('public.community_members_id_seq'::regclass);


--
-- Name: conversation_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants ALTER COLUMN id SET DEFAULT nextval('public.conversation_participants_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: etudiant_module_enrollment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etudiant_module_enrollment ALTER COLUMN id SET DEFAULT nextval('public.etudiant_module_enrollment_id_seq'::regclass);


--
-- Name: formateur_module_assignment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formateur_module_assignment ALTER COLUMN id SET DEFAULT nextval('public.formateur_module_assignment_id_seq'::regclass);


--
-- Name: message_reactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions ALTER COLUMN id SET DEFAULT nextval('public.message_reactions_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: modules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules ALTER COLUMN id SET DEFAULT nextval('public.modules_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: post_reactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions ALTER COLUMN id SET DEFAULT nextval('public.post_reactions_id_seq'::regclass);


--
-- Name: posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts ALTER COLUMN id SET DEFAULT nextval('public.posts_id_seq'::regclass);


--
-- Name: ressource_pedagogique id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ressource_pedagogique ALTER COLUMN id SET DEFAULT nextval('public.ressource_pedagogique_id_seq'::regclass);


--
-- Name: shares id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares ALTER COLUMN id SET DEFAULT nextval('public.shares_id_seq'::regclass);


--
-- Name: student_badges id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_badges ALTER COLUMN id SET DEFAULT nextval('public.student_badges_id_seq'::regclass);


--
-- Name: student_levels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_levels ALTER COLUMN id SET DEFAULT nextval('public.student_levels_id_seq'::regclass);


--
-- Name: student_progress id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_progress ALTER COLUMN id SET DEFAULT nextval('public.student_progress_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: xp_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_rules ALTER COLUMN id SET DEFAULT nextval('public.xp_rules_id_seq'::regclass);


--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.badges VALUES (1, '🌟 Débutant', 'Premier pas sur la plateforme', '🌟', 0, 0, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (2, '📚 Apprenti', '50 XP gagnés', '📚', 50, 0, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (3, '🎓 Élève', '100 XP gagnés', '🎓', 100, 0, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (4, '⚡ Intermédiaire', '300 XP gagnés', '⚡', 300, 0, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (5, '🔥 Avancé', '600 XP gagnés', '🔥', 600, 0, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (6, '🏆 Expert', '1000 XP gagnés', '🏆', 1000, 0, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (7, '💪 Maître', '3 modules complétés', '💪', 0, 3, '2026-05-09 03:01:30.127064');
INSERT INTO public.badges VALUES (8, '👑 Virtuose', '5 modules complétés', '👑', 0, 5, '2026-05-09 03:01:30.127064');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.categories VALUES (1, 'Python', 'python', 'Développement Python - De débutant à expert', 'fab fa-python', '#3776AB', 1, true, '2026-05-09 03:01:30.122485', '2026-05-09 03:01:30.122485');
INSERT INTO public.categories VALUES (2, 'PHP', 'php', 'Développement PHP - Sites web dynamiques', 'fab fa-php', '#777BB4', 2, true, '2026-05-09 03:01:30.122485', '2026-05-09 03:01:30.122485');
INSERT INTO public.categories VALUES (3, 'Node.js', 'nodejs', 'Node.js - JavaScript côté serveur', 'fab fa-node-js', '#339933', 3, true, '2026-05-09 03:01:30.122485', '2026-05-09 03:01:30.122485');
INSERT INTO public.categories VALUES (4, 'React.js', 'reactjs', 'React.js - Interfaces utilisateur modernes', 'fab fa-react', '#61DAFB', 4, true, '2026-05-09 03:01:30.122485', '2026-05-09 03:01:30.122485');


--
-- Data for Name: comment_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.comments VALUES (1, 1, 5, 'Great post! Very insightful!', 0, '2026-05-07 02:29:42.295257', '2026-05-07 02:29:42.295257');
INSERT INTO public.comments VALUES (2, 2, 5, 'Great post! Very insightful!', 0, '2026-05-07 02:31:58.756506', '2026-05-07 02:31:58.756506');
INSERT INTO public.comments VALUES (3, 3, 5, 'Great post! Very insightful!', 0, '2026-05-07 02:33:50.904677', '2026-05-07 02:33:50.904677');


--
-- Data for Name: communities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.communities VALUES (1, 'Python Community', 'python-community', 'Rejoignez la communauté Python pour apprendre ensemble, poser des questions et partager vos projets', 1, NULL, NULL, 0, 0, 0, NULL, true, '2026-05-09 03:01:30.129793', '2026-05-09 03:01:30.129793');
INSERT INTO public.communities VALUES (2, 'PHP Community', 'php-community', 'Communauté PHP - Développeurs PHP de tous niveaux', 2, NULL, NULL, 0, 0, 0, NULL, true, '2026-05-09 03:01:30.129793', '2026-05-09 03:01:30.129793');
INSERT INTO public.communities VALUES (3, 'Node.js Community', 'nodejs-community', 'Communauté Node.js - JavaScript everywhere!', 3, NULL, NULL, 0, 0, 0, NULL, true, '2026-05-09 03:01:30.129793', '2026-05-09 03:01:30.129793');
INSERT INTO public.communities VALUES (4, 'React.js Community', 'reactjs-community', 'Communauté React.js - Construisez des UIs modernes', 4, NULL, NULL, 0, 0, 0, NULL, true, '2026-05-09 03:01:30.129793', '2026-05-09 03:01:30.129793');


--
-- Data for Name: community_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.conversation_participants VALUES (1, 1, 1, '2026-05-07 03:12:25.040271', '2026-05-07 03:12:25.040271', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (2, 1, 5, '2026-05-07 03:12:25.040271', '2026-05-07 03:12:25.040271', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (3, 3, 5, '2026-05-07 03:25:28.808684', '2026-05-07 03:25:28.808684', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (4, 3, 4, '2026-05-07 03:25:28.808684', '2026-05-07 03:25:28.808684', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (5, 4, 5, '2026-05-07 03:25:28.840052', '2026-05-07 03:25:28.840052', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (6, 4, 4, '2026-05-07 03:25:28.870294', '2026-05-07 03:25:28.870294', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (7, 5, 5, '2026-05-07 03:28:06.368371', '2026-05-07 03:28:06.368371', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (9, 6, 5, '2026-05-07 03:33:14.877005', '2026-05-07 03:33:14.877005', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (10, 6, 6, '2026-05-07 03:33:14.877005', '2026-05-07 03:33:14.877005', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (11, 7, 5, '2026-05-07 03:33:14.90464', '2026-05-07 03:33:14.90464', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (12, 7, 6, '2026-05-07 03:33:14.932295', '2026-05-07 03:33:14.932295', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (14, 8, 5, '2026-05-07 03:45:00.46014', '2026-05-07 03:45:00.46014', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (16, 9, 5, '2026-05-07 03:45:00.517209', '2026-05-07 03:45:00.517209', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (17, 9, 6, '2026-05-07 03:45:00.539762', '2026-05-07 03:45:00.539762', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (18, 10, 8, '2026-05-07 03:56:17.57709', '2026-05-07 03:56:17.57709', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (19, 10, 5, '2026-05-07 03:56:17.57709', '2026-05-07 03:56:17.57709', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (20, 11, 8, '2026-05-07 03:56:17.601725', '2026-05-07 03:56:17.601725', 'OWNER', false, NULL);
INSERT INTO public.conversation_participants VALUES (21, 11, 5, '2026-05-07 03:56:17.62563', '2026-05-07 03:56:17.62563', 'MEMBER', false, NULL);
INSERT INTO public.conversation_participants VALUES (22, 11, 6, '2026-05-07 03:56:17.644017', '2026-05-07 03:56:17.644017', 'MEMBER', false, NULL);


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.conversations VALUES (1, 'PRIVATE', NULL, NULL, NULL, 1, '2026-05-07 03:12:25.03453', '2026-05-07 03:12:25.03453', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (2, 'LEVEL', 'L1 Community Chat', NULL, 'L1', NULL, '2026-05-07 03:25:28.604756', '2026-05-07 03:25:28.604756', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (3, 'PRIVATE', NULL, NULL, NULL, 5, '2026-05-07 03:25:28.805293', '2026-05-07 03:25:28.805293', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (4, 'GROUP', 'Study Group L1', NULL, NULL, 5, '2026-05-07 03:25:28.836955', '2026-05-07 03:25:28.836955', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (5, 'GROUP', 'Math Study Group', NULL, NULL, 5, '2026-05-07 03:28:06.362681', '2026-05-07 03:28:06.362681', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (6, 'PRIVATE', NULL, NULL, NULL, 5, '2026-05-07 03:33:14.873413', '2026-05-07 03:33:14.873413', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (7, 'GROUP', 'Study Group', NULL, NULL, 5, '2026-05-07 03:33:14.901884', '2026-05-07 03:33:14.901884', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (8, 'PRIVATE', NULL, NULL, NULL, NULL, '2026-05-07 03:45:00.454766', '2026-05-07 03:45:00.454766', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (9, 'GROUP', 'Study Group', NULL, NULL, NULL, '2026-05-07 03:45:00.483179', '2026-05-07 03:45:00.483179', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (10, 'PRIVATE', NULL, NULL, NULL, 8, '2026-05-07 03:56:17.57395', '2026-05-07 03:56:17.57395', true, NULL, NULL, NULL, 0, NULL, false);
INSERT INTO public.conversations VALUES (11, 'GROUP', 'Study Group', NULL, NULL, 8, '2026-05-07 03:56:17.599054', '2026-05-07 03:56:17.599054', true, NULL, NULL, NULL, 0, NULL, false);


--
-- Data for Name: etudiant_module_enrollment; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.etudiant_module_enrollment VALUES (3, 6, 2, '2026-05-08 09:15:58.695783', 'DROPPED');
INSERT INTO public.etudiant_module_enrollment VALUES (1, 5, 1, '2026-05-08 10:07:30.292173', 'ACTIVE');
INSERT INTO public.etudiant_module_enrollment VALUES (6, 10, 1, '2026-05-08 10:48:06.554637', 'ACTIVE');


--
-- Data for Name: formateur_module_assignment; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.formateur_module_assignment VALUES (1, 3, 1, 1, '2026-05-06 03:43:45.055489', false);
INSERT INTO public.formateur_module_assignment VALUES (2, 2, 1, 1, '2026-05-07 23:29:45.594422', false);
INSERT INTO public.formateur_module_assignment VALUES (3, 9, 15, 1, '2026-05-08 07:53:03.835376', false);
INSERT INTO public.formateur_module_assignment VALUES (5, 9, 5, 1, '2026-05-08 09:17:34.910793', false);
INSERT INTO public.formateur_module_assignment VALUES (6, 9, 3, 1, '2026-05-08 10:02:34.636842', false);
INSERT INTO public.formateur_module_assignment VALUES (7, 11, 4, 1, '2026-05-08 11:40:44.246478', false);
INSERT INTO public.formateur_module_assignment VALUES (8, 9, 4, 1, '2026-05-08 11:41:04.656522', false);


--
-- Data for Name: message_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.modules VALUES (1, 'L1-INFO-101', 'Introduction à la Programmation', 'Cours de base en programmation avec Python', 'L1', 6, 2.00, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (2, 'L1-INFO-102', 'Mathématiques pour l''Informatique', 'Algèbre linéaire et analyse', 'L1', 6, 2.00, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (3, 'L2-INFO-201', 'Bases de Données', 'SQL, conception et administration de BD', 'L2', 6, 2.00, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (4, 'L2-INFO-202', 'Développement Web', 'HTML, CSS, JavaScript et frameworks', 'L2', 6, 2.00, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (5, 'L3-INFO-301', 'Intelligence Artificielle', 'Introduction à l''IA et Machine Learning', 'L3', 6, 2.00, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (6, 'L3-INFO-302', 'Génie Logiciel', 'Méthodologies agiles et UML', 'L3', 6, 2.00, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (7, 'M1-INFO-401', 'Architecture Logicielle', 'Design Patterns et architecture microservices', 'M1', 8, 2.50, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (8, 'M1-INFO-402', 'Big Data', 'Technologies de traitement de données massives', 'M1', 8, 2.50, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (9, 'M2-INFO-501', 'Cloud Computing', 'AWS, Azure, et déploiement', 'M2', 8, 2.50, NULL, '2026-05-05 01:23:27.159655', '2026-05-05 01:23:27.159655', NULL, 50, 0);
INSERT INTO public.modules VALUES (10, 'L1-INFO-999', 'Test Module', 'Module for testing', 'L1', 6, 2.00, 1, '2026-05-06 03:31:27.100898', '2026-05-06 03:31:27.100898', NULL, 50, 0);
INSERT INTO public.modules VALUES (11, 'L3-ihm-01', 'IHM', 'creation d''interface', 'L3', 1, 2.00, 1, '2026-05-08 07:10:49.806515', '2026-05-08 07:10:49.806515', NULL, 50, 0);
INSERT INTO public.modules VALUES (15, 'L1-INFO-9583', 'Module Abdanour 07:53:03', 'Module créé pour le formateur Abdanour Bouhaik le Fri May  8 07:53:03 C''EST 2026', 'L1', 6, 2.00, 1, '2026-05-08 07:53:03.808804', '2026-05-08 09:52:47.038981', NULL, 50, 0);


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: post_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.post_reactions VALUES (1, 1, 5, 'INSIGHTFUL', '2026-05-07 02:29:42.272725');
INSERT INTO public.post_reactions VALUES (2, 2, 5, 'INSIGHTFUL', '2026-05-07 02:31:58.720564');
INSERT INTO public.post_reactions VALUES (3, 3, 5, 'INSIGHTFUL', '2026-05-07 02:33:50.856077');


--
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.posts VALUES (1, 5, 'Hello everyone! This is my first post on EduPlatform!', NULL, 'DISCUSSION', 1, 1, 1, '2026-05-07 02:29:42.215306', '2026-05-07 02:29:42.31496');
INSERT INTO public.posts VALUES (2, 5, 'Hello everyone! This is my first post on EduPlatform!', NULL, 'DISCUSSION', 1, 1, 1, '2026-05-07 02:31:58.61287', '2026-05-07 02:31:58.787457');
INSERT INTO public.posts VALUES (3, 5, 'Hello everyone! This is my first post on EduPlatform!', NULL, 'DISCUSSION', 1, 1, 1, '2026-05-07 02:33:50.771657', '2026-05-07 02:33:50.935078');


--
-- Data for Name: ressource_pedagogique; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.ressource_pedagogique VALUES (3, 1, 2, 'TD', 'Exercices pratiques', 'TD', 'uploads/1778189385713_td.pdf', '1778189385713_td.pdf', 24, 'application/pdf', 0, '2026-05-07 23:29:45.716243', '2026-05-07 23:29:45.716243');
INSERT INTO public.ressource_pedagogique VALUES (4, 1, 2, 'TP', 'Travaux pratiques', 'TP', 'uploads/1778189385747_tp.pdf', '1778189385747_tp.pdf', 29, 'application/pdf', 0, '2026-05-07 23:29:45.750804', '2026-05-07 23:29:45.750804');
INSERT INTO public.ressource_pedagogique VALUES (5, 1, 2, 'Examen', 'Examen final', 'Examen', 'uploads/1778189385777_examen.pdf', '1778189385777_examen.pdf', 29, 'application/pdf', 1, '2026-05-07 23:29:45.780581', '2026-05-07 23:29:45.846202');
INSERT INTO public.ressource_pedagogique VALUES (6, 15, 9, 'Cours Introduction', 'Premier cours de la session', 'Cours', 'uploads/1778219583925_test_abdanour.pdf', '1778219583925_test_abdanour.pdf', 36, 'application/pdf', 0, '2026-05-08 07:53:03.935236', '2026-05-08 07:53:03.935236');


--
-- Data for Name: shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.shares VALUES (1, 1, 5, '2026-05-07 02:29:42.31496');
INSERT INTO public.shares VALUES (2, 2, 5, '2026-05-07 02:31:58.787457');
INSERT INTO public.shares VALUES (3, 3, 5, '2026-05-07 02:33:50.935078');


--
-- Data for Name: student_badges; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: student_levels; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: student_progress; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_presence; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES (11, '2026581920', 'aminebhk@gmail.com', '$2b$10$V3xy7nYrkRTqGU0WelejiuxDatniw7EbqpZ8MTCGnKRAbDgCwItlG', NULL, 'amine ', 'med', 'FORMATEUR', NULL, true, NULL, '2026-05-08 11:37:33.08139', '2026-05-08 11:37:33.08139', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (3, '2026453743', 'formateur.test1778031824@eduplatform.com', '$2b$10$K1H8/1dVX/PkUFvcU6W3a.8ukrWiFbxNVOaTsGa.bXqKbDporYuFG', NULL, 'Test', 'Formateur', 'FORMATEUR', NULL, true, '2026-05-06 03:43:44.987317', '2026-05-06 03:43:44.867337', '2026-05-08 07:35:06.906678', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (8, NULL, 'abdanourbouhaik@gmail.com', NULL, '115062096137377008102', 'Bouhaik', 'Abdanour', 'ETUDIANT', NULL, true, '2026-05-08 11:44:50.337236', '2026-05-07 03:56:05.66687', '2026-05-08 11:44:50.337236', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (6, '2026437935', 'test.student.chat@example.com', '$2b$10$WhkxVNyqa/sFUlRScTSh1O23u6ZIYh6zJ2vh9Qwg3ocTykrxWNYei', NULL, 'Chat', 'Test', 'ETUDIANT', 'L1', true, NULL, '2026-05-07 03:33:14.711686', '2026-05-07 03:33:14.801958', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (4, '2026394227', 'reset.test@eduplatform.com', '$2b$10$uuSugIjTr1ArwGnd3yEh4upuFSsM4zsAOcxjmDsoPfx6sTUWyQCNK', NULL, 'Reset', 'Test', 'FORMATEUR', NULL, true, NULL, '2026-05-06 16:00:47.295814', '2026-05-06 16:00:49.596548', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (9, '2026754153', 'abdanourbouhaik31@gmail.com', '$2b$10$6WaazzWcN3oTP2MNDdMtVO6PYGJXaBHtxy2BBfFqRNFWXusdam5Gu', NULL, 'abdanour ', 'bouhaik', 'FORMATEUR', NULL, true, '2026-05-08 07:53:03.760486', '2026-05-08 07:47:31.57175', '2026-05-08 07:53:03.760486', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (2, '2026163513', 'test.formateur@eduplatform.com', '$2b$10$1lowuX80eV5JqTgAycJETeuzD4gjAO0vcQn/FuMHdN6Ar9vsw5Y7a', NULL, 'Test', 'Formateur', 'FORMATEUR', NULL, false, '2026-05-08 06:56:55.121774', '2026-05-06 03:31:27.218649', '2026-05-08 09:15:07.317167', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (5, NULL, 'heymowglinyoo@gmail.com', NULL, '105554499966636088884', '', 'amino', 'ETUDIANT', 'L1', true, '2026-05-08 10:32:18.106022', '2026-05-06 21:21:49.063671', '2026-05-08 10:32:18.106022', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (10, '2026689477', 'student.test.1778230086@eduplatform.com', '$2b$10$gLeBeLV06XWFXeGNrq9qnelq2Z2eJVXo9tSIeA6XsLA6ws5jXmGKW', NULL, 'TestStudent', 'CreatedByAdmin', 'ETUDIANT', 'L1', true, NULL, '2026-05-08 10:48:06.255826', '2026-05-08 10:48:06.509404', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (1, 'ADMIN001', 'aminebouhaik13@gmail.com', '$2b$10$csG21JsBC9UnUhwbDEvbLOZi9FmHvvNHhIgwNP/yBck9V3M0xxB.C', '117230847676362934686', 'Admin', 'System', 'ADMIN', NULL, true, '2026-05-08 11:32:22.267989', '2026-05-05 01:23:27.155896', '2026-05-08 11:32:22.267989', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (12, '2026852253', 'demo.superadmin@eduplatform.com', '$2b$10$dTp.qKXiLYGcn1wjYPWN9OJuJ/zVuUjKRf51zzQsX5nAqXJYsce1.', NULL, 'Super', 'Admin', 'SUPER_ADMIN', NULL, true, NULL, '2026-06-04 12:00:00', '2026-06-04 12:00:00', NULL, false, false, 0, 1);
INSERT INTO public.users VALUES (13, '2026606819', 'demo.admin@eduplatform.com', '$2b$10$dTp.qKXiLYGcn1wjYPWN9OJuJ/zVuUjKRf51zzQsX5nAqXJYsce1.', NULL, 'Admin', 'Ecole', 'ADMIN', NULL, true, NULL, '2026-06-04 12:00:00', '2026-06-04 12:00:00', NULL, false, false, 0, 1);


--
-- Data for Name: xp_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.xp_rules VALUES (1, 'COMPLETE_RESOURCE', 10, 'Compléter une ressource (cours, TD, TP, examen)', true);
INSERT INTO public.xp_rules VALUES (2, 'COMPLETE_MODULE', 100, 'Terminer tous les ressources d un module', true);
INSERT INTO public.xp_rules VALUES (3, 'JOIN_COMMUNITY', 5, 'Rejoindre une nouvelle communauté', true);
INSERT INTO public.xp_rules VALUES (4, 'POST_COMMUNITY', 2, 'Publier dans une communauté', true);
INSERT INTO public.xp_rules VALUES (5, 'DAILY_LOGIN', 1, 'Connexion quotidienne', true);


--
-- Name: badges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.badges_id_seq', 8, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.categories_id_seq', 4, true);


--
-- Name: comment_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comment_reactions_id_seq', 1, false);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_id_seq', 3, true);


--
-- Name: communities_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.communities_id_seq', 4, true);


--
-- Name: community_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.community_members_id_seq', 1, false);


--
-- Name: conversation_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversation_participants_id_seq', 22, true);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 11, true);


--
-- Name: etudiant_module_enrollment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.etudiant_module_enrollment_id_seq', 6, true);


--
-- Name: formateur_module_assignment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.formateur_module_assignment_id_seq', 8, true);


--
-- Name: message_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.message_reactions_id_seq', 1, false);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: modules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.modules_id_seq', 15, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 5, true);


--
-- Name: post_reactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_reactions_id_seq', 3, true);


--
-- Name: posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.posts_id_seq', 3, true);


--
-- Name: ressource_pedagogique_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.ressource_pedagogique_id_seq', 6, true);


--
-- Name: shares_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shares_id_seq', 3, true);


--
-- Name: student_badges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.student_badges_id_seq', 1, false);


--
-- Name: student_levels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.student_levels_id_seq', 1, false);


--
-- Name: student_progress_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.student_progress_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 11, true);


--
-- Name: xp_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.xp_rules_id_seq', 5, true);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: comment_reactions comment_reactions_comment_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE (comment_id, user_id);


--
-- Name: comment_reactions comment_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);


--
-- Name: communities communities_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_slug_key UNIQUE (slug);


--
-- Name: community_members community_members_community_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_community_id_user_id_key UNIQUE (community_id, user_id);


--
-- Name: community_members community_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: etudiant_module_enrollment etudiant_module_enrollment_etudiant_id_module_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etudiant_module_enrollment
    ADD CONSTRAINT etudiant_module_enrollment_etudiant_id_module_id_key UNIQUE (etudiant_id, module_id);


--
-- Name: etudiant_module_enrollment etudiant_module_enrollment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etudiant_module_enrollment
    ADD CONSTRAINT etudiant_module_enrollment_pkey PRIMARY KEY (id);


--
-- Name: formateur_module_assignment formateur_module_assignment_formateur_id_module_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formateur_module_assignment
    ADD CONSTRAINT formateur_module_assignment_formateur_id_module_id_key UNIQUE (formateur_id, module_id);


--
-- Name: formateur_module_assignment formateur_module_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formateur_module_assignment
    ADD CONSTRAINT formateur_module_assignment_pkey PRIMARY KEY (id);


--
-- Name: message_reactions message_reactions_message_id_user_id_reaction_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_user_id_reaction_key UNIQUE (message_id, user_id, reaction);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: modules modules_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_code_key UNIQUE (code);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: post_reactions post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_pkey PRIMARY KEY (id);


--
-- Name: post_reactions post_reactions_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: ressource_pedagogique ressource_pedagogique_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ressource_pedagogique
    ADD CONSTRAINT ressource_pedagogique_pkey PRIMARY KEY (id);


--
-- Name: shares shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_pkey PRIMARY KEY (id);


--
-- Name: shares shares_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: student_badges student_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_pkey PRIMARY KEY (id);


--
-- Name: student_badges student_badges_student_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_student_id_badge_id_key UNIQUE (student_id, badge_id);


--
-- Name: student_levels student_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_levels
    ADD CONSTRAINT student_levels_pkey PRIMARY KEY (id);


--
-- Name: student_levels student_levels_student_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_levels
    ADD CONSTRAINT student_levels_student_id_key UNIQUE (student_id);


--
-- Name: student_progress student_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_pkey PRIMARY KEY (id);


--
-- Name: student_progress student_progress_student_id_module_id_resource_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_student_id_module_id_resource_id_key UNIQUE (student_id, module_id, resource_id);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_matricule_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_matricule_key UNIQUE (matricule);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: xp_rules xp_rules_action_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_rules
    ADD CONSTRAINT xp_rules_action_type_key UNIQUE (action_type);


--
-- Name: xp_rules xp_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xp_rules
    ADD CONSTRAINT xp_rules_pkey PRIMARY KEY (id);


--
-- Name: idx_assignments_formateur; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_formateur ON public.formateur_module_assignment USING btree (formateur_id);


--
-- Name: idx_assignments_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignments_module ON public.formateur_module_assignment USING btree (module_id);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_communities_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communities_category ON public.communities USING btree (category_id);


--
-- Name: idx_communities_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communities_slug ON public.communities USING btree (slug);


--
-- Name: idx_community_members_community; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_members_community ON public.community_members USING btree (community_id);


--
-- Name: idx_community_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_members_user ON public.community_members USING btree (user_id);


--
-- Name: idx_conversations_community; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_community ON public.conversations USING btree (community_id);


--
-- Name: idx_conversations_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_level ON public.conversations USING btree (level_name);


--
-- Name: idx_conversations_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_type ON public.conversations USING btree (conversation_type);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_created ON public.messages USING btree (created_at);


--
-- Name: idx_messages_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_user ON public.messages USING btree (user_id);


--
-- Name: idx_modules_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_modules_category ON public.modules USING btree (category_id);


--
-- Name: idx_modules_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_modules_code ON public.modules USING btree (code);


--
-- Name: idx_modules_niveau; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_modules_niveau ON public.modules USING btree (niveau);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read, created_at DESC);


--
-- Name: idx_participants_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_participants_conversation ON public.conversation_participants USING btree (conversation_id);


--
-- Name: idx_participants_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_participants_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_resources_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resources_category ON public.ressource_pedagogique USING btree (category);


--
-- Name: idx_resources_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resources_module ON public.ressource_pedagogique USING btree (module_id);


--
-- Name: idx_student_progress_module; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_progress_module ON public.student_progress USING btree (module_id);


--
-- Name: idx_student_progress_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_progress_status ON public.student_progress USING btree (status);


--
-- Name: idx_student_progress_student; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_progress_student ON public.student_progress USING btree (student_id);


--
-- Name: idx_tokens_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tokens_expires ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_tokens_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_matricule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_matricule ON public.users USING btree (matricule);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role_global);


--
-- Name: comments trigger_comment_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_comment_count AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();


--
-- Name: comments trigger_comments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_posts_updated_at();


--
-- Name: posts trigger_posts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_posts_updated_at();


--
-- Name: post_reactions trigger_reaction_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_reaction_count AFTER INSERT OR DELETE ON public.post_reactions FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();


--
-- Name: shares trigger_share_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_share_count AFTER INSERT OR DELETE ON public.shares FOR EACH ROW EXECUTE FUNCTION public.update_post_counts();


--
-- Name: messages trigger_update_conversation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: modules update_modules_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ressource_pedagogique update_resources_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.ressource_pedagogique FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: comment_reactions comment_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comment_reactions comment_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_reactions
    ADD CONSTRAINT comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: communities communities_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: communities communities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: community_members community_members_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: community_members community_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_last_message_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_last_message_by_fkey FOREIGN KEY (last_message_by) REFERENCES public.users(id);


--
-- Name: etudiant_module_enrollment etudiant_module_enrollment_etudiant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etudiant_module_enrollment
    ADD CONSTRAINT etudiant_module_enrollment_etudiant_id_fkey FOREIGN KEY (etudiant_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: etudiant_module_enrollment etudiant_module_enrollment_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.etudiant_module_enrollment
    ADD CONSTRAINT etudiant_module_enrollment_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: formateur_module_assignment formateur_module_assignment_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formateur_module_assignment
    ADD CONSTRAINT formateur_module_assignment_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: formateur_module_assignment formateur_module_assignment_formateur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formateur_module_assignment
    ADD CONSTRAINT formateur_module_assignment_formateur_id_fkey FOREIGN KEY (formateur_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: formateur_module_assignment formateur_module_assignment_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.formateur_module_assignment
    ADD CONSTRAINT formateur_module_assignment_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reactions message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_reactions
    ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_reply_to_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_reply_to_message_id_fkey FOREIGN KEY (reply_to_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: messages messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: modules modules_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: modules modules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_reactions post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_reactions post_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ressource_pedagogique ressource_pedagogique_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ressource_pedagogique
    ADD CONSTRAINT ressource_pedagogique_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: ressource_pedagogique ressource_pedagogique_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ressource_pedagogique
    ADD CONSTRAINT ressource_pedagogique_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shares shares_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: shares shares_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_badges student_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: student_badges student_badges_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_badges
    ADD CONSTRAINT student_badges_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_levels student_levels_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_levels
    ADD CONSTRAINT student_levels_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: student_progress student_progress_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: student_progress student_progress_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.ressource_pedagogique(id) ON DELETE CASCADE;


--
-- Name: student_progress student_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_progress
    ADD CONSTRAINT student_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_presence user_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict FVVQ3LG3TH2PrrXHLc9FXfSV0p6yCQ3YzWCwbKa9moUJg2Zk2vMiD7LmToMfSzv

