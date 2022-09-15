// NOTE: This file is indirectly imported by server.ts, our custom server, and
// cannot import anything from the rest of our codebase using our shorter, @/
// style imports or the production Docker image will break
import {
  AnyEntity,
  Entity,
  EntityName,
  Enum,
  GetRepository,
  Index,
  IntegerType,
  ManyToOne,
  OneToOne,
  PrimaryKey,
  Property,
  RequestContext,
  Unique,
} from "@mikro-orm/core";
import {
  EntityRepository,
  PostgreSqlDriver,
  SqlEntityManager,
} from "@mikro-orm/postgresql";
import { v4 } from "uuid";

/**
 * Get a repository for the given {@param entity} from the express application
 * context on the {@param request} argument.
 */
export function getEntityManager(): SqlEntityManager<PostgreSqlDriver> {
  // safe because src/server.ts ensures this is valid
  const em = RequestContext.getEntityManager();
  if (!em)
    throw new Error(
      "Entity manager not found. Are you in a 'withORM'-wrapped Context?"
    );
  return em as unknown as SqlEntityManager<PostgreSqlDriver>;
}

/**
 * Get a repository for the given {@param entity} from the express application
 * context on the {@param request} argument.
 */
export function getRepository<T extends AnyEntity>(
  entity: EntityName<T>
): GetRepository<T, EntityRepository<T>> {
  // safe because src/server.ts ensures this is valid
  const em = RequestContext.getEntityManager();
  if (!em)
    throw new Error(
      "Entity manager not found. Are you in a 'withORM'-wrapped Context?"
    );
  return em.getRepository(entity);
}

/**
 * Base for all of our entities, ensures all have a primary key that is a
 * generated, v4 UUID, and that every table has creation and update timestamps
 * that are automatically set,
 */
export abstract class BaseEntity {
  @PrimaryKey()
  id = v4();

  @Property()
  createdOn = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedOn = new Date();
}

/**
 * What kind of membership, free or paid.
 */
export enum PlanType {
  Free = "free",
  Plus = "plus",
}

/**
 * The role of a specific user within a membership.
 */
export enum Role {
  Owner = "owner",
  Member = "member",
}

/**
 * Constrain to known good values for deductibles on a quote.
 */
export enum Deductible {
  _0 = 0,
  _100 = 100,
  _250 = 250,
}

/**
 * Subscription status values from Stripe so we can track locally, set through
 * checkout and via webhooks.
 */
export enum StripeStatus {
  Active = "active",
  Trialing = "trialing",
  Incomplete = "incomplete",
  IncompleteExpired = "incomplete_expired",
  PastDue = "past_due",
  Canceled = "canceled",
  Unpaid = "unpaid",
}

/**
 * Contract status values from AUL, to track a warranty contract through the
 * purchase process.
 */
export enum ContractStatus {
  Open = "open",
  Signed = "signed",
  Paid = "paid",
  Remitted = "remitted",
  Void = "void",
}

@Entity()
export class MembershipSequence {
  @PrimaryKey()
  id!: number;

  @Property({ length: 8, nullable: false })
  val!: number;
}

/**
 * Details of a membership.
 */
@Entity()
export class Membership extends BaseEntity {
  @Unique()
  @Property({ length: 8, nullable: false })
  membershipId!: number;

  @Unique()
  @Property()
  stripeCustomerId?: string;

  @Enum(() => PlanType)
  planType?: string;

  @Enum(() => StripeStatus)
  status?: string;

  @Property()
  currentPeriodStart?: Date;

  @Property()
  currentPeriodEnd?: Date;

  @Property()
  cancelAt?: Date;
}

@Entity()
export class Address extends BaseEntity {
  @Property()
  address1?: string;

  @Property()
  address2?: string;

  @Property()
  city?: string;

  @Property({ length: 2 })
  state?: string;

  @Property()
  zipCode?: string;
}

/**
 * Actual users that may log into our app.
 */
@Entity()
export class User extends BaseEntity {
  @ManyToOne()
  membership = new Membership();

  @ManyToOne({ nullable: true })
  address?: Address;

  @Property()
  @Enum(() => Role)
  role: string = Role.Owner;

  @Unique()
  @Property({ onUpdate: emailToLower, onCreate: emailToLower })
  email!: string;

  @Property()
  emailVerified? = false;

  @Property()
  firstName?: string;

  @Property()
  lastName?: string;

  @Property()
  image?: string;

  @Property({ length: 9, onUpdate: phoneToNumeric, onCreate: phoneToNumeric })
  phone?: string;

  @Property()
  @Unique()
  @Index()
  clerkUserId!: string;
}

// utility to ensure consistent lookups from the database
function emailToLower(u: User) {
  return u.email.toLowerCase();
}

// removes any formatting, the front end will take care of consistent
// presentation of the purely numeric string we store
function phoneToNumeric(u: User) {
  return u.phone === undefined ? u.phone : u.phone.replace(/[^0-9]/, "");
}

/**
 * Common columns for our vehicle tables, including the foreign key relation to
 * {@type User}.
 */
export abstract class BaseVehicle extends BaseEntity {
  @ManyToOne()
  user!: User;

  @Property({ length: 17, onCreate: vinToUpper, onUpdate: vinToUpper })
  vin!: string;
}

// utility to ensure consistent lookups from the database
function vinToUpper(v: BaseVehicle) {
  return v.vin.toUpperCase();
}

/**
 * Represents a vehicle a user has saved, as opposed to one they own.
 */
@Entity()
export class VehicleFavorite extends BaseVehicle {
  @Property()
  mcListingId!: string;

  @Property({ type: IntegerType })
  mileage?: number;

  @Property({ type: IntegerType })
  advertisedPrice!: number;

  @Property()
  vdpUrl!: string;

  @Property()
  imgUrl?: string;

  @Property()
  city?: string;

  @Property({ length: 2 })
  state?: string;
}

/**
 * Represents a vehicle owned by a user.
 */
@Entity()
export class VehicleOwned extends BaseVehicle {
  @Property()
  licensePlate?: string;

  @Property({ type: IntegerType })
  mileage!: number;

  @Property({ type: IntegerType, nullable: false })
  payoffAmount = 0;
}

/**
 * A user may generate valuations for a vehicle they own.
 */
@Entity()
export class VehicleOwnedValuation extends BaseEntity {
  @ManyToOne()
  VehicleOwned!: VehicleOwned;

  @Property({ type: IntegerType })
  predictedPrice!: number;

  @Property({ type: IntegerType })
  mileage!: number;

  @Property()
  zipCode!: string;
}

/**
 * Represents a quoted rate for a warranty contract.
 */
@Entity()
export class VscRate extends BaseEntity {
  @Property({ type: IntegerType })
  pricerId!: number;

  @Property({ length: 8 })
  programCode!: string;

  @Property({ length: 64 })
  programText!: string;

  @Property({ length: 64 })
  coverage!: string;

  @Property({ type: IntegerType })
  price!: number;

  @Property({ type: IntegerType })
  months!: number;

  @Property({ type: IntegerType })
  miles!: number;

  @Property({ nullable: false })
  businesUse = false;

  @Property({ nullable: false })
  liftKit = false;

  @Property()
  sealsGaskets?: boolean;

  @Property()
  enhancedElectricPack?: boolean;

  @Property()
  disappearingDeductible?: boolean;

  @Property()
  warrantyRemaining?: boolean;

  @Property({ type: IntegerType, fieldName: "deductible_0" })
  deductible0?: number;

  @Property({ type: IntegerType, fieldName: "deductible_100" })
  deductible100!: number;

  @Property({ type: IntegerType, fieldName: "deductible_250" })
  deductible250?: number;
}

/**
 * Represents a purchased contract, unique to a given {@type VehicleOwned} and
 * {@type VscRate}, an extension table to {@type VscRate} meaning most uses
 * will also populate that field.
 */
@Entity()
export class VscContract extends BaseEntity {
  @ManyToOne()
  user!: User;

  @OneToOne()
  vehicleOwned!: VehicleOwned;

  @OneToOne()
  vscRate!: VscRate;

  @Enum(() => ContractStatus)
  status!: string;

  @Property({ length: 128 })
  filename?: string;

  @Property({ type: IntegerType })
  vehicleMileage!: number;

  @Property({ type: IntegerType })
  vehiclePrice!: number;

  @Property({ type: IntegerType })
  retailCost!: number;

  @Property({ nullable: false })
  vehicleInWarranty = false;

  @Enum(() => Deductible)
  deductible!: number;

  @Property()
  businesUse!: boolean;

  @Property()
  liftKit!: boolean;

  @Property()
  sealsGaskets?: boolean;

  @Property()
  enhancedElectricPack?: boolean;

  @Property()
  disappearingDeductible?: boolean;

  @Property()
  warrantyRemaining?: boolean;
}

/**
 * A collection of all of our entities, make sure to add any new entities here
 * so our custom server and command line tools see and can work with them.
 */
export const ENTITIES = [
  Address,
  BaseEntity,
  BaseVehicle,
  Membership,
  MembershipSequence,
  User,
  VehicleFavorite,
  VehicleOwned,
  VehicleOwnedValuation,
  VscRate,
  VscContract,
];
