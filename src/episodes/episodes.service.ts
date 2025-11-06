import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Episode, EpisodeDocument } from '@/episodes/schemas/episode.schema';
import { CreateEpisodeDto } from '@/episodes/dto/create-episode.dto';
import { UpdateEpisodeDto } from '@/episodes/dto/update-episode.dto';
import { QueryEpisodeDto } from '@/episodes/dto/query-episode.dto';

@Injectable()
export class EpisodesService {
  constructor(@InjectModel(Episode.name) private readonly episodeModel: Model<EpisodeDocument>) {}

  async create(dto: CreateEpisodeDto) {
    const exists = await this.episodeModel.exists({ animeId: dto.animeId, number: dto.number }).lean();
    if (exists) throw new ConflictException('Episode number already exists for this anime');
    const payload = { ...dto, animeId: new Types.ObjectId(dto.animeId) } as any;
    const doc = await this.episodeModel.create(payload);
    return doc.toObject();
  }

  async findAll(query: QueryEpisodeDto) {
    const { animeId, q, offset = 0, limit = 20 } = query;
    const filter: FilterQuery<EpisodeDocument> = {} as any;
    if (animeId) (filter as any).animeId = new Types.ObjectId(animeId);
    if (q && q.trim()) {
      (filter as any).$or = [
        { title: { $regex: q, $options: 'i' } },
        { synopsis: { $regex: q, $options: 'i' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.episodeModel.find(filter).sort({ number: 1, createdAt: -1 }).skip(offset).limit(limit).lean().exec(),
      this.episodeModel.countDocuments(filter).exec(),
    ]);
    return { items, total, offset, limit };
  }

  async findOne(id: string) {
    const doc = await this.episodeModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException('Episode not found');
    return doc;
  }

  async update(id: string, dto: UpdateEpisodeDto) {
    if (dto.number !== undefined || dto.animeId !== undefined) {
      const current = await this.episodeModel.findById(id).select('animeId').lean().exec();
      if (!current) throw new NotFoundException('Episode not found');
      const newAnimeId = dto.animeId ? new Types.ObjectId(dto.animeId) : (current as any).animeId;
      const newNumber = dto.number ?? undefined;
      if (newNumber !== undefined) {
        const dup = await this.episodeModel.exists({ _id: { $ne: id }, animeId: newAnimeId, number: newNumber }).lean();
        if (dup) throw new ConflictException('Episode number already exists for this anime');
      }
      if (dto.animeId) (dto as any).animeId = newAnimeId;
    }
    const doc = await this.episodeModel.findByIdAndUpdate(id, dto as any, { new: true }).lean().exec();
    if (!doc) throw new NotFoundException('Episode not found');
    return doc;
  }

  async remove(id: string) {
    const res = await this.episodeModel.findByIdAndDelete(id).lean().exec();
    if (!res) throw new NotFoundException('Episode not found');
    return { deleted: true } as const;
  }
}


