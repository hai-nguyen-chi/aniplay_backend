import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Anime, AnimeDocument } from '@/anime/schemas/anime.schema';
import { CreateAnimeDto } from '@/anime/dto/create-anime.dto';
import { UpdateAnimeDto } from '@/anime/dto/update-anime.dto';
import { QueryAnimeDto } from '@/anime/dto/query-anime.dto';

@Injectable()
export class AnimeService {
  constructor(@InjectModel(Anime.name) private readonly animeModel: Model<AnimeDocument>) {}

  async create(dto: CreateAnimeDto) {
    const exists = await this.animeModel.exists({ slug: dto.slug }).lean();
    if (exists) throw new ConflictException('Slug already exists');
    const doc = await this.animeModel.create(dto);
    return doc.toObject();
  }

  async findAll(query: QueryAnimeDto) {
    const { q, offset = 0, limit = 20 } = query;
    const filter: FilterQuery<AnimeDocument> = {} as any;
    if (q && q.trim()) {
      (filter as any).$or = [
        { title: { $regex: q, $options: 'i' } },
        { slug: { $regex: q, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.animeModel.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).lean().exec(),
      this.animeModel.countDocuments(filter).exec(),
    ]);
    return { items, total, offset, limit };
  }

  async findOne(id: string) {
    const doc = await this.animeModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Anime not found');
    return doc;
  }

  async update(id: string, dto: UpdateAnimeDto) {
    if ((dto as any).slug) {
      const dup = await this.animeModel.exists({ _id: { $ne: id }, slug: (dto as any).slug }).lean();
      if (dup) throw new ConflictException('Slug already exists');
    }
    const doc = await this.animeModel.findByIdAndUpdate(id, dto, { new: true }).lean().exec();
    if (!doc) throw new NotFoundException('Anime not found');
    return doc;
  }

  async remove(id: string) {
    const res = await this.animeModel.findByIdAndDelete(id).lean().exec();
    if (!res) throw new NotFoundException('Anime not found');
    return { deleted: true } as const;
  }
}


