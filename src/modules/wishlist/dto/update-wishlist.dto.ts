import { PartialType } from '@nestjs/mapped-types';
import { AddToWishlistDto } from './add-to-wishlist.dto';

export class UpdateWishlistDto extends PartialType(AddToWishlistDto) {}